import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/modules/warehouse/config";
import { adminEmails, isAdmin, type InquiryStatus, listInquiries, setInquiryStatus, STATUSES } from "@/modules/warehouse/inquiries";
import type { Quote } from "@/modules/warehouse/quote";

export const metadata: Metadata = { title: "Inquiries" };
export const dynamic = "force-dynamic";

const LABEL: Record<InquiryStatus, string> = { new: "🆕 New", contacted: "💬 Contacted", won: "✅ Won", lost: "✖ Lost" };

async function mark(form: FormData) {
  "use server";
  const user = await getCurrentUser(await headers());
  if (!user || !isAdmin(user.email)) redirect("/login?next=/admin/inquiries");
  await setInquiryStatus(String(form.get("id")), String(form.get("status")) as InquiryStatus, user.email);
  redirect("/admin/inquiries");
}

const fmt = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });

/** warehouse-site (episode 022): every inquiry in one place, newest first. Only WAREHOUSE_ADMIN_EMAILS can open it. */
export default async function InquiriesPage() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/admin/inquiries");
  if (!isAdmin(user.email)) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-16">
        <h1 className="text-3xl font-black">Inquiries</h1>
        <p className="text-muted">
          {adminEmails().length
            ? "This page is for the warehouse owner only."
            : "Set WAREHOUSE_ADMIN_EMAILS (your email) in the host's variables to open this page."}
        </p>
      </main>
    );
  }

  const rows = await listInquiries();
  const counts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">warehouse-site · admin</span>
          <h1 className="text-3xl font-black">Inquiries</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {STATUSES.map((s) => (
            <span key={s} className="rounded-full border border-line px-3 py-1 tabular-nums">
              {LABEL[s]} {counts[s]}
            </span>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line p-6 text-muted">
          No inquiries yet. Send a test one from <Link className="underline" href="/contact">/contact</Link>.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r) => {
            const q = r.quote as unknown as Quote | null;
            return (
              <li key={r.id} className={`flex flex-col gap-3 rounded-2xl border p-5 ${r.status === "new" ? "border-accent" : "border-line"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-lg font-bold">
                    {r.name}
                    {r.company && <span className="font-normal text-muted"> · {r.company}</span>}
                  </div>
                  <time className="text-sm tabular-nums text-muted">{fmt(r.createdAt)}</time>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <a className="underline" href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone && <span>💬 {r.phone}</span>}
                  {r.platforms && <span>🛒 {r.platforms}</span>}
                  {r.monthlyOrders && <span>📦 {r.monthlyOrders} / mo</span>}
                  <span className="text-muted">{r.lang === "en" ? "EN" : "中文"}</span>
                </div>
                {r.message && <p className="whitespace-pre-wrap text-sm">{r.message}</p>}
                {q?.total != null && (
                  <div className="rounded-xl bg-accent/10 px-4 py-2 text-sm">
                    Quote: <b>{money(q.total)}</b> / mo · {money(q.perOrder)} / order · {q.input?.ordersPerMonth} orders
                  </div>
                )}
                <form action={mark} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      name="status"
                      value={s}
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${r.status === s ? "border-ink bg-ink text-paper" : "border-line"}`}
                      aria-pressed={r.status === s}
                    >
                      {LABEL[s]}
                    </button>
                  ))}
                </form>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
