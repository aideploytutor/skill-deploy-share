import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payPayments } from "@/db/schema";
import { emitEvent } from "@/lib/events";

/**
 * pay-checkout (episode 010): take payments with Creem, a merchant of record
 * (it handles worldwide sales tax and pays out to bank accounts in mainland China too).
 * Uses plain fetch + Web Crypto, so it runs on Vercel and on Cloudflare Workers.
 * Test keys (creem_test_...) automatically talk to Creem's test API: no real money moves.
 */
export function isPayConfigured(): boolean {
  return Boolean(process.env.CREEM_API_KEY);
}
export function payMode(): "test" | "live" {
  return (process.env.CREEM_API_KEY ?? "").startsWith("creem_test_") ? "test" : "live";
}
function apiBase(): string {
  return payMode() === "test" ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1";
}
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
}

async function creem<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiBase() + path, {
    ...init,
    headers: { "x-api-key": process.env.CREEM_API_KEY ?? "", "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Creem ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body) as T;
}

export type Product = { id: string; name: string; description?: string; price: number; currency: string; billing_type?: string };

export async function getProduct(productId: string): Promise<Product> {
  return creem<Product>(`/products?product_id=${encodeURIComponent(productId)}`);
}

/** Start a checkout for a signed-in user and return the Creem payment page URL. */
export async function startCheckout(user: { id: string; email: string }, productId: string): Promise<string> {
  if (!siteUrl()) throw new Error("NEXT_PUBLIC_SITE_URL is not set, so Creem wouldn't know where to send buyers back.");
  const db = getDb();
  const [row] = await db
    .insert(payPayments)
    .values({ userId: user.id, mode: payMode(), productId })
    .returning({ id: payPayments.id });
  const checkout = await creem<{ id: string; checkout_url: string }>("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      request_id: row.id,
      customer: { email: user.email },
      success_url: `${siteUrl()}/pay/success`,
      metadata: { userId: user.id, paymentId: row.id },
    }),
  });
  await db.update(payPayments).set({ checkoutId: checkout.id }).where(eq(payPayments.id, row.id));
  return checkout.checkout_url;
}

type CreemCheckout = {
  id: string;
  status: string;
  request_id?: string;
  order?: { id: string; amount: number; currency: string; status: string };
};

/** Record a completed checkout. Safe to call many times (webhook retries + success page). */
export async function markPaid(checkout: CreemCheckout): Promise<boolean> {
  if (!checkout.request_id || checkout.status !== "completed") return false;
  const db = getDb();
  const updated = await db
    .update(payPayments)
    .set({
      status: "paid",
      checkoutId: checkout.id,
      orderId: checkout.order?.id ?? null,
      amount: checkout.order?.amount ?? null,
      currency: checkout.order?.currency ?? null,
      paidAt: new Date(),
    })
    .where(and(eq(payPayments.id, checkout.request_id), eq(payPayments.status, "pending")))
    .returning({ id: payPayments.id, userId: payPayments.userId, productId: payPayments.productId });
  const p = updated[0];
  if (p) {
    await emitEvent({
      type: "pay.paid",
      source: "pay-checkout",
      subjectId: p.id,
      payload: { userId: p.userId, productId: p.productId, amount: checkout.order?.amount, currency: checkout.order?.currency, mode: payMode() },
    });
  }
  return Boolean(p);
}

/** Ask Creem directly whether a checkout is paid: never trust the browser's word for it. */
export async function confirmCheckout(checkoutId: string): Promise<CreemCheckout> {
  const checkout = await creem<CreemCheckout>(`/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`);
  await markPaid(checkout);
  return checkout;
}

/** Verify a webhook: HMAC-SHA256 of the raw body with CREEM_WEBHOOK_SECRET, hex, header `creem-signature`. */
export async function verifyWebhook(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export async function listPayments(userId: string) {
  return getDb().select().from(payPayments).where(eq(payPayments.userId, userId)).orderBy(desc(payPayments.createdAt)).limit(20);
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "USD").toUpperCase() }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency ?? ""}`;
  }
}
