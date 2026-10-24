import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { coreEvents, payGrants, payPayments, payWebhookEvents } from "@/db/schema";
import { emitEvent } from "@/lib/events";
import { confirmCheckout, markPaid, payMode } from "@/lib/pay";

/**
 * pay-webhook (episode 012): handle every payment automatically, never miss one.
 * - Each thing Creem reports (a checkout, a refund, a dispute) is recorded once and processed once,
 *   even when Creem delivers it again or the owner presses Resend.
 * - A paid payment unlocks access (pay_grants); a full refund or chargeback takes it away.
 * - reconcile() asks Creem about payments still pending, for when every notification failed.
 */

type CreemEvent = { id?: string; eventType?: string; object?: Record<string, any> };
type Result = { status: "done" | "ignored"; paymentId?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Find our payment from a Creem object: request_id is our payment id, else match the checkout id. */
async function findPayment(requestId?: string, checkoutId?: string) {
  const db = getDb();
  const conds = [];
  if (requestId && UUID.test(requestId)) conds.push(eq(payPayments.id, requestId));
  if (checkoutId) conds.push(eq(payPayments.checkoutId, checkoutId));
  if (!conds.length) return undefined;
  const [p] = await db.select().from(payPayments).where(or(...conds)).limit(1);
  return p;
}

/** Unlock what a paid payment bought. Safe to call many times. */
export async function grantFor(paymentId: string): Promise<boolean> {
  const db = getDb();
  const [p] = await db.select().from(payPayments).where(eq(payPayments.id, paymentId));
  if (!p || p.status !== "paid") return false;
  const rows = await db
    .insert(payGrants)
    .values({ userId: p.userId, productId: p.productId, paymentId: p.id })
    .onConflictDoNothing()
    .returning({ id: payGrants.id });
  if (rows[0]) {
    await emitEvent({ type: "pay.granted", source: "pay-webhook", subjectId: p.id, payload: { userId: p.userId, productId: p.productId } });
  }
  return Boolean(rows[0]);
}

async function revoke(paymentId: string, reason: "refunded" | "disputed") {
  await getDb()
    .update(payGrants)
    .set({ revokedAt: new Date(), revokeReason: reason })
    .where(and(eq(payGrants.paymentId, paymentId), isNull(payGrants.revokedAt)));
}

async function processEvent(event: CreemEvent): Promise<Result> {
  const o = event.object ?? {};
  switch (event.eventType) {
    case "checkout.completed": {
      if (!o.request_id || !UUID.test(o.request_id)) return { status: "ignored" }; // not started by this site
      await markPaid(o as Parameters<typeof markPaid>[0]);
      const p = await findPayment(o.request_id, o.id);
      if (!p) return { status: "ignored" };
      await grantFor(p.id);
      return { status: "done", paymentId: p.id };
    }
    case "refund.created": {
      const p = await findPayment(o.checkout?.request_id, o.checkout?.id);
      if (!p) return { status: "ignored" };
      if (p.status === "refunded") return { status: "done", paymentId: p.id }; // already fully refunded
      const refunded = Number(o.refund_amount ?? 0);
      const full = p.amount == null || refunded >= p.amount;
      if (full) {
        await getDb().update(payPayments).set({ status: "refunded" }).where(eq(payPayments.id, p.id));
        await revoke(p.id, "refunded");
      }
      await emitEvent({
        type: "pay.refunded",
        source: "pay-webhook",
        subjectId: p.id,
        payload: { userId: p.userId, productId: p.productId, amount: refunded, currency: o.refund_currency, full, reason: o.reason ?? null },
      });
      return { status: "done", paymentId: p.id };
    }
    case "dispute.created": {
      const p = await findPayment(o.checkout?.request_id, o.checkout?.id);
      if (!p) return { status: "ignored" };
      if (p.status === "disputed") return { status: "done", paymentId: p.id };
      await getDb().update(payPayments).set({ status: "disputed" }).where(eq(payPayments.id, p.id));
      await revoke(p.id, "disputed");
      await emitEvent({
        type: "pay.disputed",
        source: "pay-webhook",
        subjectId: p.id,
        payload: { userId: p.userId, productId: p.productId, amount: o.amount, currency: o.currency },
      });
      return { status: "done", paymentId: p.id };
    }
    default:
      return { status: "ignored" }; // subscriptions etc. are handled by later skills
  }
}

/**
 * Handle one verified Creem notification. Returns "duplicate" for one already handled.
 * Throws if processing fails, so the webhook answers 500 and Creem tries again later.
 */
export async function handleCreemEvent(event: CreemEvent): Promise<Result["status"] | "duplicate"> {
  if (!event.id || !event.eventType) return "ignored";
  // Key on what happened, not on the delivery: Creem's "Resend" gives the same refund a new event id.
  const key = typeof event.object?.id === "string" ? `${event.eventType}:${event.object.id}` : event.id;
  const db = getDb();
  const fresh = await db
    .insert(payWebhookEvents)
    .values({ id: key, type: event.eventType })
    .onConflictDoNothing()
    .returning({ id: payWebhookEvents.id });
  if (!fresh[0]) {
    const [seen] = await db.select({ status: payWebhookEvents.status }).from(payWebhookEvents).where(eq(payWebhookEvents.id, key));
    if (seen && seen.status !== "failed") return "duplicate";
  }
  try {
    const r = await processEvent(event);
    await db
      .update(payWebhookEvents)
      .set({ status: r.status, paymentId: r.paymentId ?? null, error: null, processedAt: new Date() })
      .where(eq(payWebhookEvents.id, key));
    return r.status;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(payWebhookEvents).set({ status: "failed", error: message.slice(0, 500) }).where(eq(payWebhookEvents.id, key));
    throw e;
  }
}

/** Does this user currently have what they paid for? */
export async function hasAccess(userId: string, productId?: string): Promise<boolean> {
  const conds = [eq(payGrants.userId, userId), isNull(payGrants.revokedAt)];
  if (productId) conds.push(eq(payGrants.productId, productId));
  const [g] = await getDb().select({ id: payGrants.id }).from(payGrants).where(and(...conds)).limit(1);
  return Boolean(g);
}

export async function listGrants(userId: string) {
  return getDb().select().from(payGrants).where(eq(payGrants.userId, userId)).orderBy(desc(payGrants.grantedAt)).limit(20);
}

/** Make sure every paid payment of this user has its grant (the success page can be faster than the webhook). */
export async function ensureGrants(userId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: payPayments.id })
    .from(payPayments)
    .leftJoin(payGrants, eq(payGrants.paymentId, payPayments.id))
    .where(and(eq(payPayments.userId, userId), eq(payPayments.status, "paid"), isNull(payGrants.id)));
  for (const r of rows) await grantFor(r.id);
}

/**
 * Catch up on anything the notifications missed: ask Creem about recent pending payments,
 * and unlock paid ones that have no grant yet. Runs at most once every 5 minutes.
 */
export async function reconcile() {
  const db = getDb();
  const [last] = await db
    .select({ at: coreEvents.createdAt })
    .from(coreEvents)
    .where(eq(coreEvents.type, "pay.reconciled"))
    .orderBy(desc(coreEvents.createdAt))
    .limit(1);
  if (last && Date.now() - last.at.getTime() < 5 * 60_000) return { skipped: "ran less than 5 minutes ago" };

  const now = Date.now();
  const pending = await db
    .select({ id: payPayments.id, checkoutId: payPayments.checkoutId })
    .from(payPayments)
    .where(
      and(
        eq(payPayments.status, "pending"),
        eq(payPayments.mode, payMode()),
        gt(payPayments.createdAt, new Date(now - 7 * 86_400_000)),
        lt(payPayments.createdAt, new Date(now - 2 * 60_000)),
      ),
    )
    .orderBy(desc(payPayments.createdAt))
    .limit(25);

  let recovered = 0;
  let errors = 0;
  for (const p of pending) {
    if (!p.checkoutId) continue;
    try {
      const c = await confirmCheckout(p.checkoutId); // marks it paid if Creem says so
      if (c.status === "completed" && (await grantFor(p.id))) recovered++;
    } catch {
      errors++;
    }
  }

  const missing = await db
    .select({ id: payPayments.id })
    .from(payPayments)
    .leftJoin(payGrants, eq(payGrants.paymentId, payPayments.id))
    .where(and(eq(payPayments.status, "paid"), isNull(payGrants.id)))
    .limit(50);
  let repaired = 0;
  for (const m of missing) if (await grantFor(m.id)) repaired++;

  const summary = { checked: pending.length, recovered, repaired, errors };
  await emitEvent({ type: "pay.reconciled", source: "pay-webhook", payload: summary });
  return summary;
}
