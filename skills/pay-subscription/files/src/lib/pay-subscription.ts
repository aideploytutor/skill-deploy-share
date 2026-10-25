import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { authUsers, payPayments, paySubscriptions } from "@/db/schema";
import { emitEvent } from "@/lib/events";
import { payMode } from "@/lib/pay";
import type { CreemHandler } from "@/lib/pay-webhook";

/**
 * pay-subscription (episode 013): charge every month, automatically.
 * Creem bills the card each period and tells us (subscription.paid); we extend access to the new
 * period end. Cancel → access lasts to the end of what was paid. A failed renewal gets 3 days' grace.
 * Plugs into pay-webhook: handleCreemEvent(event, [handleSubscriptionEvent]).
 */

const GRACE_MS = 3 * 86_400_000;

export type Subscription = typeof paySubscriptions.$inferSelect;

const STATUS: Record<string, string> = {
  "subscription.active": "active",
  "subscription.paid": "active",
  "subscription.trialing": "trialing",
  "subscription.past_due": "past_due",
  "subscription.scheduled_cancel": "scheduled_cancel",
  "subscription.canceled": "canceled",
  "subscription.unpaid": "unpaid",
  "subscription.paused": "paused",
};

function date(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(typeof v === "number" && v < 1e12 ? v * 1000 : (v as string | number));
  return Number.isNaN(d.getTime()) ? null : d;
}
function idOf(v: unknown): string | undefined {
  return typeof v === "string" ? v : typeof (v as { id?: unknown })?.id === "string" ? (v as { id: string }).id : undefined;
}

/** Until when does this subscription give access? null = no access. */
export function accessUntil(s: Pick<Subscription, "status" | "currentPeriodEnd">): Date | null {
  const end = s.currentPeriodEnd;
  switch (s.status) {
    case "active":
    case "trialing":
    case "past_due": // Creem is retrying the card
      return end ? new Date(end.getTime() + GRACE_MS) : new Date(8.64e15);
    case "scheduled_cancel":
    case "canceled": // paid until the end of the period
      return end;
    default:
      return null;
  }
}
export function hasAccessNow(s: Pick<Subscription, "status" | "currentPeriodEnd">): boolean {
  const until = accessUntil(s);
  return Boolean(until && until.getTime() > Date.now());
}

export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  return getDb().select().from(paySubscriptions).where(eq(paySubscriptions.userId, userId)).orderBy(desc(paySubscriptions.createdAt));
}

/** Is this user subscribed right now (to this product, or to anything)? */
export async function hasActiveSubscription(userId: string, productId?: string): Promise<boolean> {
  const subs = await listSubscriptions(userId);
  return subs.some((s) => (!productId || s.productId === productId) && hasAccessNow(s));
}

// --- Creem API -------------------------------------------------------------------------------

async function creem<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = payMode() === "test" ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1";
  const res = await fetch(base + path, {
    ...init,
    headers: { "x-api-key": process.env.CREEM_API_KEY ?? "", "content-type": "application/json" },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Creem ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body) as T;
}

/** Ask Creem for the latest state (used when a renewal looks overdue, or a webhook was missed). */
export async function syncSubscription(id: string): Promise<Subscription | undefined> {
  const o = await creem<Record<string, any>>(`/subscriptions?subscription_id=${encodeURIComponent(id)}`);
  const status = typeof o.status === "string" ? o.status : undefined;
  const [row] = await getDb()
    .update(paySubscriptions)
    .set({
      ...(status ? { status } : {}),
      ...(date(o.current_period_end_date) ? { currentPeriodEnd: date(o.current_period_end_date)! } : {}),
      ...(idOf(o.customer) ? { customerId: idOf(o.customer)! } : {}),
      updatedAt: new Date(),
    })
    .where(eq(paySubscriptions.id, id))
    .returning();
  return row;
}

/** A one-time link to Creem's portal, where the subscriber can cancel or change their card. */
export async function portalLink(customerId: string): Promise<string> {
  const r = await creem<{ customer_portal_link: string }>("/customers/billing", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId }),
  });
  return r.customer_portal_link;
}

// --- Webhook handler -------------------------------------------------------------------------

export const handleSubscriptionEvent: CreemHandler = async (event, builtIn) => {
  const o = event.object ?? {};
  const type = event.eventType ?? "";
  const db = getDb();

  // First payment: pay-webhook recorded it; link the subscription to the buyer.
  if (type === "checkout.completed") {
    const subId = idOf(o.subscription);
    if (!subId || !builtIn.paymentId) return null;
    const [p] = await db.select().from(payPayments).where(eq(payPayments.id, builtIn.paymentId));
    if (!p) return null;
    const end = date(o.subscription?.current_period_end_date);
    const values = { userId: p.userId, productId: p.productId, customerId: idOf(o.customer) ?? null, firstPaymentId: p.id };
    const inserted = await db
      .insert(paySubscriptions)
      .values({ id: subId, ...values, status: "active", mode: p.mode, currentPeriodEnd: end })
      .onConflictDoUpdate({ target: paySubscriptions.id, set: { ...values, updatedAt: new Date() } })
      .returning({ end: paySubscriptions.currentPeriodEnd });
    if (!inserted[0]?.end) await syncSubscription(subId).catch(() => undefined);
    await emitEvent({ type: "pay.subscribed", source: "pay-subscription", subjectId: subId, payload: { userId: p.userId, productId: p.productId } });
    return { status: "done", paymentId: p.id };
  }

  // A refunded subscription payment ends the subscription's access.
  if (type === "refund.created") {
    const subId = idOf(o.subscription);
    if (!subId) return null;
    const rows = await db
      .update(paySubscriptions)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(and(eq(paySubscriptions.id, subId), sql`${paySubscriptions.status} <> 'refunded'`))
      .returning();
    if (rows[0]) {
      await emitEvent({ type: "pay.subscription_ended", source: "pay-subscription", subjectId: subId, payload: { userId: rows[0].userId, productId: rows[0].productId, reason: "refunded" } });
    }
    return null;
  }

  if (!type.startsWith("subscription.") || typeof o.id !== "string") return null;
  const subId: string = o.id;
  let [row] = await db.select().from(paySubscriptions).where(eq(paySubscriptions.id, subId));

  if (!row) {
    // The subscription event beat checkout.completed: our checkout put the buyer in metadata.
    const userId = typeof o.metadata?.userId === "string" ? o.metadata.userId : undefined;
    const productId = idOf(o.product);
    if (!userId || !productId) return { status: "ignored" }; // not started by this site
    const [u] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, userId));
    if (!u) return { status: "ignored" };
    [row] = await db
      .insert(paySubscriptions)
      .values({ id: subId, userId, productId, status: STATUS[type] ?? "active", mode: payMode(), customerId: idOf(o.customer) ?? null, currentPeriodEnd: date(o.current_period_end_date) })
      .onConflictDoNothing()
      .returning();
    if (!row) [row] = await db.select().from(paySubscriptions).where(eq(paySubscriptions.id, subId));
  }

  let status = STATUS[type] ?? row.status;
  if (type === "subscription.expired") status = o.status === "canceled" || o.status === "expired" ? "expired" : row.status;
  if (type === "subscription.update" && typeof o.status === "string") status = o.status;
  const end = date(o.current_period_end_date) ?? row.currentPeriodEnd;
  const renewed = type === "subscription.paid" && row.currentPeriodEnd != null && end != null && end.getTime() > row.currentPeriodEnd.getTime() + 86_400_000;

  await db
    .update(paySubscriptions)
    .set({
      status,
      currentPeriodEnd: end,
      customerId: idOf(o.customer) ?? row.customerId,
      canceledAt: status === "canceled" ? date(o.canceled_at) ?? new Date() : row.canceledAt,
      renewals: renewed ? row.renewals + 1 : row.renewals,
      updatedAt: new Date(),
    })
    .where(eq(paySubscriptions.id, subId));

  const payload = { userId: row.userId, productId: row.productId, periodEnd: end?.toISOString() ?? null };
  if (renewed) {
    await emitEvent({ type: "pay.renewed", source: "pay-subscription", subjectId: subId, payload: { ...payload, amount: o.product?.price ?? null, currency: o.product?.currency ?? null, transactionId: o.last_transaction_id ?? null } });
  } else if (status === "scheduled_cancel" && row.status !== "scheduled_cancel") {
    await emitEvent({ type: "pay.subscription_canceling", source: "pay-subscription", subjectId: subId, payload });
  } else if (["canceled", "expired", "unpaid", "paused"].includes(status) && status !== row.status) {
    await emitEvent({ type: "pay.subscription_ended", source: "pay-subscription", subjectId: subId, payload: { ...payload, reason: status } });
  }
  return { status: "done" };
};
