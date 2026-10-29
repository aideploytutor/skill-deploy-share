import { and, count, desc, eq, gt } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { warehouseInquiries } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { emitEvent } from "@/lib/events";
import { type Lang, money, warehouse } from "./config";
import type { Quote } from "./quote";

/** warehouse-site (episode 022): store inquiries, email the owner and the seller, list them for the owner. */

export const STATUSES = ["new", "contacted", "won", "lost"] as const;
export type InquiryStatus = (typeof STATUSES)[number];
export type Inquiry = typeof warehouseInquiries.$inferSelect;

export type InquiryInput = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  platforms?: string[];
  monthlyOrders?: string;
  message?: string;
  quote?: Quote | null;
  lang: Lang;
};

const clip = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Owner emails, from WAREHOUSE_ADMIN_EMAILS (comma-separated). They can open /admin/inquiries. */
export function adminEmails(): string[] {
  return (process.env.WAREHOUSE_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isAdmin(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(String(email).toLowerCase());
}

export async function createInquiry(raw: InquiryInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isDbConfigured()) return { ok: false, error: "database not configured" };
  const name = clip(raw.name, 80);
  const email = clip(raw.email, 160).toLowerCase();
  if (!name) return { ok: false, error: raw.lang === "en" ? "please enter your name" : "请填写称呼" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: raw.lang === "en" ? "please check your email" : "邮箱格式不对" };

  const db = getDb();
  // At most 3 inquiries per email in 10 minutes: stops double clicks and simple spam.
  const [{ value: recent }] = await db
    .select({ value: count() })
    .from(warehouseInquiries)
    .where(and(eq(warehouseInquiries.email, email), gt(warehouseInquiries.createdAt, new Date(Date.now() - 10 * 60_000))));
  if (recent >= 3) return { ok: false, error: raw.lang === "en" ? "already received, we'll reply soon" : "已经收到了，请稍等我们回复" };

  const [row] = await db
    .insert(warehouseInquiries)
    .values({
      name,
      email,
      phone: clip(raw.phone, 80) || null,
      company: clip(raw.company, 120) || null,
      platforms: (raw.platforms ?? []).map((p) => clip(p, 30)).filter(Boolean).join(", ") || null,
      monthlyOrders: clip(raw.monthlyOrders, 30) || null,
      message: clip(raw.message, 2000) || null,
      quote: raw.quote ? (raw.quote as unknown as Record<string, unknown>) : null,
      lang: raw.lang,
    })
    .returning();

  await emitEvent({
    type: "warehouse.inquiry_received",
    source: "warehouse-site",
    subjectId: row.id,
    payload: { platforms: row.platforms, monthlyOrders: row.monthlyOrders, quoteTotal: raw.quote?.total ?? null },
  });

  await notify(row, raw.quote ?? null);
  return { ok: true, id: row.id };
}

function quoteLines(q: Quote): string {
  const i = q.input;
  return [
    `${i.lengthIn}×${i.widthIn}×${i.heightIn} in, ${i.weightLb} lb${q.oversize ? " (oversize)" : ""}`,
    `${i.ordersPerMonth} orders/mo × ${i.itemsPerOrder} items, ${i.unitsStored} units stored, ${i.unitsInbound} received/mo`,
    `Receiving ${money(q.receiving)} · Storage ${money(q.storage)} · Pick & pack ${money(q.pick)}${q.oversizeFee ? ` · Oversize ${money(q.oversizeFee)}` : ""}`,
    `Total ${money(q.total)}/mo (${money(q.perOrder)}/order), postage excluded`,
  ].join("\n");
}

/** Owner gets the details; the seller gets a short confirmation. Failures are logged, never block the inquiry. */
async function notify(row: Inquiry, quote: Quote | null) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inbox = process.env.WAREHOUSE_INBOX_EMAIL || adminEmails()[0];
  const lines = [
    `Name: ${row.name}`,
    `Email: ${row.email}`,
    row.phone && `WeChat / phone: ${row.phone}`,
    row.company && `Store: ${row.company}`,
    row.platforms && `Platforms: ${row.platforms}`,
    row.monthlyOrders && `Orders/month: ${row.monthlyOrders}`,
    row.message && `\n${row.message}`,
    quote && `\nQuote they saw:\n${quoteLines(quote)}`,
  ].filter(Boolean).join("\n");

  if (inbox) {
    const r = await sendEmail({
      to: inbox,
      subject: `New inquiry: ${row.name}${row.company ? ` (${row.company})` : ""}${row.monthlyOrders ? ` · ${row.monthlyOrders} orders/mo` : ""}`,
      text: `${lines}\n\nAll inquiries: ${site}/admin/inquiries`,
      html: `<pre style="font:14px/1.6 system-ui,sans-serif;white-space:pre-wrap">${esc(lines)}</pre><p><a href="${site}/admin/inquiries">Open all inquiries</a></p>`,
      replyTo: row.email,
      tag: "warehouse-inquiry",
      idempotencyKey: `inquiry-owner-${row.id}`,
    });
    if (!r.ok) console.error("[warehouse] owner email failed:", r.error);
  } else {
    console.warn("[warehouse] no WAREHOUSE_INBOX_EMAIL or WAREHOUSE_ADMIN_EMAILS: inquiry saved but nobody was emailed");
  }

  const zh = row.lang !== "en";
  const confirm = zh
    ? `${row.name} 你好，\n\n我们已经收到你的咨询，会在一个工作日内联系你。${quote ? `\n\n你看到的报价估算：\n${quoteLines(quote)}` : ""}\n\n${warehouse.name}\n${site}`
    : `Hi ${row.name},\n\nThanks for reaching out. We'll get back to you within one business day.${quote ? `\n\nYour estimate:\n${quoteLines(quote)}` : ""}\n\n${warehouse.name}\n${site}`;
  const r2 = await sendEmail({
    to: row.email,
    subject: zh ? `${warehouse.name}：已收到你的咨询` : `${warehouse.name}: we got your inquiry`,
    text: confirm,
    html: `<pre style="font:14px/1.6 system-ui,sans-serif;white-space:pre-wrap">${esc(confirm)}</pre>`,
    replyTo: inbox || undefined,
    tag: "warehouse-confirm",
    idempotencyKey: `inquiry-confirm-${row.id}`,
  });
  if (!r2.ok) console.error("[warehouse] confirmation email failed:", r2.error);
}

export async function listInquiries(limit = 100): Promise<Inquiry[]> {
  if (!isDbConfigured()) return [];
  return getDb().select().from(warehouseInquiries).orderBy(desc(warehouseInquiries.createdAt)).limit(limit);
}

export async function setInquiryStatus(id: string, status: InquiryStatus, by: string) {
  if (!STATUSES.includes(status)) return;
  const [row] = await getDb()
    .update(warehouseInquiries)
    .set({ status, updatedAt: new Date() })
    .where(eq(warehouseInquiries.id, id))
    .returning({ id: warehouseInquiries.id });
  if (row) await emitEvent({ type: "warehouse.inquiry_status_changed", source: "warehouse-site", subjectId: id, payload: { status, by } });
}
