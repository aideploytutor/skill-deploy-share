import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDbConfigured } from "@/db";
import { type Lang, langFrom, money, orderRanges, pick, platformOptions, t, warehouse } from "@/modules/warehouse/config";
import { createInquiry } from "@/modules/warehouse/inquiries";
import { estimate, type Quote } from "@/modules/warehouse/quote";
import { C, SiteShell } from "@/modules/warehouse/ui";

export const metadata: Metadata = { title: "Contact · 联系我们" };
export const dynamic = "force-dynamic";

/** The quote travels as ?q={...inputs}; the server recalculates it, so nobody can send a fake price. */
function quoteFrom(q: string | undefined): Quote | null {
  if (!q) return null;
  try {
    const parsed = JSON.parse(q);
    const quote = estimate(parsed && typeof parsed === "object" ? parsed : {});
    return quote.input.ordersPerMonth > 0 ? quote : null;
  } catch {
    return null;
  }
}

async function send(form: FormData) {
  "use server";
  const lang: Lang = form.get("lang") === "en" ? "en" : "zh";
  const q = String(form.get("q") ?? "");
  const back = (extra: string) => `/contact?${lang === "en" ? "lang=en&" : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}${extra}`;
  if (form.get("website")) redirect(back("sent=1")); // honeypot: bots fill every field
  const r = await createInquiry({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    company: String(form.get("company") ?? ""),
    platforms: form.getAll("platforms").map(String),
    monthlyOrders: String(form.get("monthlyOrders") ?? ""),
    message: String(form.get("message") ?? ""),
    quote: quoteFrom(q),
    lang,
  });
  redirect(r.ok ? back("sent=1") : back(`error=${encodeURIComponent(r.error)}`));
}

const input = "w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-3 text-base text-[#0F172A] outline-none focus:border-[#0B1F3A] focus:ring-2 focus:ring-[#0B1F3A]/15";
const label = "flex flex-col gap-1.5 text-sm font-semibold text-[#475569]";

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ lang?: string; q?: string; sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const lang = langFrom(sp.lang);
  const K = t.contact;
  const quote = quoteFrom(sp.q);

  return (
    <SiteShell lang={lang} path="/contact">
      <main className={`${C.soft} min-h-full`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-7 px-5 py-14 sm:px-8">
          <section className="flex min-w-0 flex-[999_1_540px] flex-col gap-7">
            <header className="flex flex-col gap-2.5">
              <span className={C.kicker}>{pick(K.kicker, lang)}</span>
              <h1 className="text-3xl font-black tracking-tight sm:text-[44px]">{pick(K.title, lang)}</h1>
              <p className={`text-[17px] ${C.muted}`}>{pick(K.lede, lang)}</p>
            </header>

            {sp.sent ? (
              <p className="flex items-center gap-3 rounded-2xl border-2 border-[#16A34A] bg-white p-6 text-lg font-bold">✅ {pick(K.sent, lang)}</p>
            ) : (
              <form action={send} className="flex flex-col gap-5 rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-7">
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="q" value={sp.q ?? ""} />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                {sp.error && <p className="rounded-xl bg-[#FFEDD5] p-3 text-sm font-bold text-[#9A3412]">{pick(K.error, lang)}{sp.error}</p>}
                {!isDbConfigured() && <p className="rounded-xl bg-[#FFEDD5] p-3 text-sm">Database not connected yet (DATABASE_URL).</p>}

                {quote && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0B1F3A] px-5 py-4 text-white">
                    <span className="font-bold">📎 {pick(K.attached, lang)}</span>
                    <span className="text-sm text-[#CBD5E1]">
                      {quote.input.ordersPerMonth.toLocaleString("en-US")} orders/mo · <b className="text-white">{money(quote.total)}</b> / mo · {money(quote.perOrder)} / order
                    </span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>
                    {pick(K.name, lang)} *
                    <input name="name" required maxLength={80} className={input} autoComplete="name" />
                  </label>
                  <label className={label}>
                    {pick(K.email, lang)} *
                    <input name="email" type="email" required maxLength={160} className={input} autoComplete="email" />
                  </label>
                  <label className={label}>
                    {pick(K.phone, lang)}
                    <input name="phone" maxLength={80} className={input} />
                  </label>
                  <label className={label}>
                    {pick(K.company, lang)}
                    <input name="company" maxLength={120} className={input} autoComplete="organization" />
                  </label>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-sm font-semibold text-[#475569]">{pick(K.platforms, lang)}</legend>
                  <div className="flex flex-wrap gap-2">
                    {platformOptions.map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2 rounded-full border border-[#CBD5E1] px-3.5 py-2 text-[15px] has-[:checked]:border-[#0B1F3A] has-[:checked]:bg-[#EEF2F8] has-[:checked]:font-bold">
                        <input type="checkbox" name="platforms" value={p} className="accent-[#0B1F3A]" />
                        {p}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className={label}>
                  {pick(K.monthlyOrders, lang)}
                  <select name="monthlyOrders" className={input} defaultValue={quote ? range(quote.input.ordersPerMonth) : ""}>
                    <option value="">—</option>
                    {orderRanges.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>

                <label className={label}>
                  {pick(K.message, lang)}
                  <textarea name="message" rows={4} maxLength={2000} className={input} />
                </label>

                <button type="submit" className="w-fit rounded-xl bg-[#D9480F] px-9 py-3.5 text-[17px] font-extrabold text-white transition hover:bg-[#C2410C] active:scale-95">
                  {pick(K.send, lang)}
                </button>
              </form>
            )}
          </section>

          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-2xl bg-[#0B1F3A] p-7 text-[15px] text-[#CBD5E1]">
            <div className="text-xl font-extrabold text-white">{warehouse.name}</div>
            <div>📍 {pick(warehouse.location.city, lang)}</div>
            <div>{warehouse.location.address}</div>
            {warehouse.contact.wechat && (
              <div>
                💬 {pick(K.wechat, lang)}: <b className="text-white">{warehouse.contact.wechat}</b>
              </div>
            )}
            {warehouse.contact.phone && <div>📞 {warehouse.contact.phone}</div>}
            <div>
              🕘 {pick(K.hours, lang)}: {pick(warehouse.contact.hours, lang)}
            </div>
          </aside>
        </div>
      </main>
    </SiteShell>
  );
}

function range(orders: number): string {
  if (orders < 300) return orderRanges[0];
  if (orders < 1000) return orderRanges[1];
  if (orders < 5000) return orderRanges[2];
  return orderRanges[3];
}
