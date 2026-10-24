import { and, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { payEvents, payPayments } from "@/db/schema";
import { emitEvent } from "@/lib/events";
import { confirmCheckout, markPaid, payMode } from "@/lib/pay";

/**
 * pay-webhook (episode 012): handle every Creem notification exactly once, and catch the ones that never arrive.
 *  - receiveEvent(): store the event (by Creem's event id), then act on it. Duplicates are recognised.
 *  - checkout.completed → payment paid (pay.paid); refund.created → refunded (pay.refunded); dispute.created → disputed (pay.disputed).
 *  - reconcile(): for payments still "pending", ask Creem directly; retry events that failed. Run it on a schedule.
 *  - hasPaid(): what other pages use to unlock things.
 * Creem retries a failed delivery only for about 6 hours (30 s, 5 min, 30 min, 6 h), so the schedule is the safety net.
 */
export type CreemEvent = { id: string; eventType: string; created_at?: number; object?: Record<string, unknown> };
type Outcome = "processed" | "ignored";

const idOf = (v: unknown): string | undefined =>
  typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : undefined;

/** Store an event once and act on it. Throws if acting failed, so the webhook answers 500 and Creem retries. */
export async function receiveEvent(event: CreemEvent): Promise<Outcome | "duplicate"> {
  const [row] = await getDb()
    .insert(payEvents)
    .values({ id: event.id, type: event.eventType, payload: event as unknown as Record<string, unknown> })
    .onConflictDoUpdate({ target: payEvents.id, set: { deliveries: sql`${payEvents.deliveries} + 1` } })
    .returning({ status: payEvents.status });
  if (row.status === "processed" || row.status === "ignored") return "duplicate";
  return processEvent(event);
}

async function processEvent(event: CreemEvent): Promise<Outcome> {
  const db = getDb();
  try {
    const outcome = await act(event);
    await db
      .update(payEvents)
      .set({ status: outcome, error: null, processedAt: new Date(), attempts: sql`${payEvents.attempts} + 1` })
      .where(eq(payEvents.id, event.id));
    return outcome;
  } catch (err) {
    await db
      .update(payEvents)
      .set({ status: "failed", error: String(err instanceof Error ? err.message : err).slice(0, 500), attempts: sql`${payEvents.attempts} + 1` })
      .where(eq(payEvents.id, event.id));
    throw err;
  }
}

async function act(event: CreemEvent): Promise<Outcome> {
  const o = event.object ?? {};
  switch (event.eventType) {
    case "checkout.completed": {
      const requestId = typeof o.request_id === "string" ? o.request_id : undefined;
      if (!requestId || !(await findPayment({ id: requestId }))) return "ignored"; // not started on this site
      await markPaid(o as Parameters<typeof markPaid>[0]);
      return "processed";
    }
    case "refund.created":
      return (await settle(o, "refund")) ? "processed" : "ignored";
    case "dispute.created":
      return (await settle(o, "dispute")) ? "processed" : "ignored";
    default:
      return "ignored"; // subscriptions etc. are handled by later skills
  }
}

async function findPayment(by: { id?: string; checkoutId?: string; orderId?: string }) {
  const conds = [
    by.id ? eq(payPayments.id, by.id) : undefined,
    by.checkoutId ? eq(payPayments.checkoutId, by.checkoutId) : undefined,
    by.orderId ? eq(payPayments.orderId, by.orderId) : undefined,
  ].filter((c) => c !== undefined);
  if (!conds.length) return undefined;
  if (by.id && !/^[0-9a-f-]{36}$/i.test(by.id)) return undefined; // not one of our uuids
  const [p] = await getDb().select().from(payPayments).where(or(...conds)).limit(1);
  return p;
}

/** Refund or dispute: take access away and tell other systems. */
async function settle(o: Record<string, unknown>, kind: "refund" | "dispute"): Promise<boolean> {
  const p = await findPayment({ checkoutId: idOf(o.checkout), orderId: idOf(o.order) });
  if (!p) return false;
  const amount = kind === "refund" ? Number(o.refund_amount ?? NaN) : Number(o.amount ?? NaN);
  const full = !Number.isFinite(amount) || p.amount == null || amount >= p.amount;
  const status = kind === "dispute" ? "disputed" : full ? "refunded" : "partially_refunded";
  const updated = await getDb()
    .update(payPayments)
    .set({ status })
    .where(and(eq(payPayments.id, p.id), inArray(payPayments.status, ["paid", "partially_refunded"])))
    .returning({ id: payPayments.id });
  if (updated.length) {
    await emitEvent({
      type: kind === "refund" ? "pay.refunded" : "pay.disputed",
      source: "pay-webhook",
      subjectId: p.id,
      payload: { userId: p.userId, productId: p.productId, amount: Number.isFinite(amount) ? amount : null, currency: p.currency, full, status },
    });
  }
  return true;
}

/** Statuses that count as "bought". A partial refund keeps access; a full refund or a dispute removes it. */
export const OWNED = ["paid", "partially_refunded"] as const;

/** Has this user paid for this product (or anything, if productId is left out)? */
export async function hasPaid(userId: string, productId?: string): Promise<boolean> {
  const where = and(eq(payPayments.userId, userId), inArray(payPayments.status, [...OWNED]), productId ? eq(payPayments.productId, productId) : undefined);
  const [row] = await getDb().select({ id: payPayments.id }).from(payPayments).where(where).limit(1);
  return Boolean(row);
}

export const STATUS_LABEL: Record<string, string> = {
  paid: "✅ Paid",
  pending: "⏳ Not completed",
  refunded: "↩️ Refunded",
  partially_refunded: "↩️ Partly refunded",
  disputed: "⚠️ Disputed",
};

export type ReconcileResult = { checked: number; recovered: number; stillOpen: number; retried: number; errors: string[] };

/**
 * The safety net. Payments started 2 minutes to 3 days ago that are still pending: ask Creem.
 * Events that failed (or crashed half-way): handle them again, up to 10 tries.
 */
export async function reconcile(opts: { minAgeMinutes?: number; maxAgeHours?: number } = {}): Promise<ReconcileResult> {
  const db = getDb();
  const now = Date.now();
  const newest = new Date(now - (opts.minAgeMinutes ?? 2) * 60_000);
  const oldest = new Date(now - (opts.maxAgeHours ?? 72) * 3_600_000);
  const result: ReconcileResult = { checked: 0, recovered: 0, stillOpen: 0, retried: 0, errors: [] };

  const pending = await db
    .select({ id: payPayments.id, checkoutId: payPayments.checkoutId })
    .from(payPayments)
    .where(and(eq(payPayments.status, "pending"), eq(payPayments.mode, payMode()), isNotNull(payPayments.checkoutId), gte(payPayments.createdAt, oldest), lt(payPayments.createdAt, newest)))
    .limit(50);
  for (const p of pending) {
    result.checked++;
    try {
      const c = await confirmCheckout(p.checkoutId!);
      if (c.status === "completed") result.recovered++;
      else result.stillOpen++;
    } catch (err) {
      result.errors.push(`payment ${p.id}: ${err instanceof Error ? err.message : err}`.slice(0, 200));
    }
  }

  const stuck = await db
    .select()
    .from(payEvents)
    .where(and(inArray(payEvents.status, ["failed", "received"]), lt(payEvents.receivedAt, newest), lt(payEvents.attempts, 10)))
    .limit(50);
  for (const e of stuck) {
    try {
      await processEvent(e.payload as unknown as CreemEvent);
      result.retried++;
    } catch (err) {
      result.errors.push(`event ${e.id}: ${err instanceof Error ? err.message : err}`.slice(0, 200));
    }
  }

  if (result.recovered || result.retried) {
    await emitEvent({ type: "pay.reconciled", source: "pay-webhook", payload: { ...result, errors: result.errors.length } });
  }
  return result;
}
