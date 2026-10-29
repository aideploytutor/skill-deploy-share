import Link from "next/link";
import { langFrom, money, pick, t, warehouse } from "@/modules/warehouse/config";
import { estimate } from "@/modules/warehouse/quote";
import { C, Icon, SiteShell, withLang } from "@/modules/warehouse/ui";

/** warehouse-site (episode 022): the warehouse's front page. Edit src/modules/warehouse/config.ts, not this file. */
export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = langFrom((await searchParams).lang);
  const r = warehouse.rates;
  const sample = estimate({ lengthIn: 10, widthIn: 8, heightIn: 4, weightLb: 2, ordersPerMonth: 1000, itemsPerOrder: 1, unitsStored: 2000, unitsInbound: 1000 });
  const rows = [
    ["receivingPerUnit", r.receivingPerUnit],
    ["storagePerCubicFootMonth", r.storagePerCubicFootMonth],
    ["pickFirstItem", r.pickFirstItem],
    ["pickExtraItem", r.pickExtraItem],
    ["oversizePerOrder", r.oversizePerOrder],
  ] as const;
  const stock = [
    { sku: "SKU-A 收纳盒 · 白", avail: "812", inbound: "400", low: false },
    { sku: "SKU-B 收纳盒 · 灰", avail: "96", inbound: "0", low: true },
    { sku: "SKU-C 挂钩 6 件装", avail: "2,340", inbound: "1,200", low: false },
  ];
  const wrap = "mx-auto max-w-6xl px-5 sm:px-8";

  return (
    <SiteShell lang={lang} path="/">
      {/* Hero */}
      <section className={`${C.navy} pb-24 pt-14 text-white sm:pt-20`}>
        <div className={`${wrap} flex flex-wrap items-center gap-14`}>
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
            <span className="w-fit rounded-full border border-[#5C3A2A] bg-[#1E2A3F] px-3.5 py-1.5 text-sm font-semibold text-[#FFB48A]">{pick(warehouse.badge, lang)}</span>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-[56px]">
              {pick(warehouse.heroLine1, lang)}
              <br />
              <span className="text-[#FF8A4C]">{pick(warehouse.heroLine2, lang)}</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#CBD5E1]">{pick(warehouse.intro, lang)}</p>
            <div className="mt-2 flex flex-wrap gap-3.5">
              <Link href={withLang("/quote", lang)} className={`rounded-xl px-7 py-4 text-[17px] font-bold transition active:scale-95 ${C.orangeBtn}`}>
                {pick(t.heroCta, lang)}
              </Link>
              <Link href={withLang("/contact", lang)} className="rounded-xl border border-[#4B6185] px-7 py-4 text-[17px] font-semibold transition hover:bg-white/5 active:scale-95">
                {pick(t.heroCta2, lang)}
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <span className="text-sm text-[#94A3B8]">{pick(t.platformsLabel, lang)}</span>
              <div className="flex flex-wrap gap-2.5">
                {warehouse.platforms.map((p) => (
                  <span key={p} className="rounded-lg bg-[#15294A] px-3.5 py-2 text-sm font-bold text-[#E2E8F0]">{p}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative min-w-0 flex-[1_1_420px]">
            <div className="flex h-[420px] flex-col items-center justify-center gap-2.5 rounded-2xl bg-[repeating-linear-gradient(135deg,#16305A_0px,#16305A_14px,#1A3766_14px,#1A3766_28px)] text-[#94A3B8]">
              <Icon name="box" size={56} color="#94A3B8" />
              <span className="font-semibold">[ {pick(t.photo, lang)} ]</span>
            </div>
            <div className="absolute -bottom-9 left-0 flex w-72 flex-col gap-1.5 rounded-2xl bg-white p-5 text-[#0F172A] shadow-2xl sm:-left-7">
              <span className="text-[13px] font-semibold text-[#475569]">{pick(t.heroCard, lang)}</span>
              <span className="text-[34px] font-extrabold tracking-tight">
                {money(sample.total, 0)}
                <span className="text-base font-semibold text-[#475569]"> / {lang === "en" ? "mo" : "月"}</span>
              </span>
              <span className="text-sm text-[#475569]">
                {pick(t.heroCardPer, lang)} <b className="text-[#0F172A]">{money(sample.perOrder)}</b> · {pick(t.heroCardNote, lang)}
              </span>
            </div>
            <div className="absolute right-2 top-6 flex items-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#0F172A] shadow-xl sm:-right-4">
              <span className="size-2.5 rounded-full bg-[#16A34A]" />
              {pick(t.cutoff, lang)}
            </div>
          </div>
        </div>
      </section>

      {/* Proof numbers */}
      <section className={`border-b ${C.line} bg-white py-10`}>
        <dl className={`${wrap} grid grid-cols-2 gap-6 md:grid-cols-4`}>
          {warehouse.stats.map((s) => (
            <div key={s.value} className="flex flex-col gap-1">
              <dt className="text-3xl font-extrabold tracking-tight sm:text-4xl">{s.value}</dt>
              <dd className={`text-[15px] ${C.muted}`}>{pick(s.label, lang)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Services */}
      <section id="services" className={`${C.soft} py-24`}>
        <div className={`${wrap} flex flex-col gap-12`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <span className={C.kicker}>{pick(t.servicesKicker, lang)}</span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{pick(t.servicesTitle, lang)}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {warehouse.services.map((s) => (
              <div key={s.title.en} className={`flex flex-col gap-3.5 rounded-2xl border ${C.line} bg-white p-7`}>
                <span className="grid size-12 place-items-center rounded-xl bg-[#EEF2F8]">
                  <Icon name={s.icon} color="#0B1F3A" />
                </span>
                <h3 className="text-xl font-extrabold">{pick(s.title, lang)}</h3>
                <p className={`text-[15px] leading-relaxed ${C.muted}`}>{pick(s.body, lang)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white py-24">
        <div className={`${wrap} flex flex-col gap-12`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <span className={C.kicker}>{pick(t.howKicker, lang)}</span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{pick(t.howTitle, lang)}</h2>
          </div>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {warehouse.steps.map((s, i) => (
              <li key={s.title.en} className="flex flex-col gap-3 border-t-[3px] border-[#0B1F3A] pt-5">
                <span className="text-sm font-extrabold text-[#D9480F]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-xl font-extrabold">{pick(s.title, lang)}</h3>
                <p className={`text-[15px] leading-relaxed ${C.muted}`}>{pick(s.body, lang)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={`${C.soft} py-24`}>
        <div className={`${wrap} flex flex-wrap items-start gap-12`}>
          <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
            <span className={C.kicker}>{pick(t.pricingKicker, lang)}</span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{pick(t.pricingTitle, lang)}</h2>
            <p className={`text-[17px] leading-relaxed ${C.muted}`}>{pick(t.pricingBody, lang)}</p>
            <Link href={withLang("/quote", lang)} className="mt-2 w-fit rounded-xl bg-[#0B1F3A] px-6 py-3.5 font-bold text-white transition hover:bg-[#12305A] active:scale-95">
              {pick(t.pricingCta, lang)}
            </Link>
            <span className="text-[13px] text-[#64748B]">{pick(t.pricingNote, lang)}</span>
          </div>
          <div className={`min-w-0 flex-[1_1_520px] overflow-hidden rounded-2xl border ${C.line} bg-white`}>
            <table className="w-full text-left text-[15px]">
              <tbody className="divide-y divide-[#E2E8F0]">
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row" className="px-7 py-4 font-semibold">{pick(t.priceRows[k], lang)}</th>
                    <td className="px-7 py-4 text-right tabular-nums">
                      <b className="text-lg">{money(v)}</b> <span className="text-[#64748B]">{pick(t.priceUnits[k], lang)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Client portal preview */}
      <section className={`${C.navy} py-24 text-white`}>
        <div className={`${wrap} flex flex-wrap items-center gap-14`}>
          <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
            <span className="text-sm font-bold tracking-wide text-[#FF8A4C]">{pick(t.portalKicker, lang)}</span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{pick(t.portalTitle, lang)}</h2>
            <p className="text-[17px] leading-relaxed text-[#CBD5E1]">{pick(t.portalBody, lang)}</p>
          </div>
          <div className="min-w-0 flex-[1_1_580px] overflow-hidden rounded-2xl bg-white text-[#0F172A] shadow-2xl">
            <div className={`flex flex-wrap items-center justify-between gap-2 border-b ${C.line} px-5 py-3.5`}>
              <span className="text-[15px] font-extrabold">
                {t.portalTabs[lang][0]} <span className="ml-1 rounded bg-[#FFEDD5] px-1.5 py-0.5 text-[11px] font-bold text-[#9A3412]">{pick(t.portalSample, lang)}</span>
              </span>
              <div className="flex gap-1.5 text-[13px]">
                {t.portalTabs[lang].map((tab, i) => (
                  <span key={tab} className={i === 0 ? "rounded-md bg-[#0B1F3A] px-2.5 py-1 font-semibold text-white" : "px-2.5 py-1 text-[#475569]"}>{tab}</span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[#F5F7FA] text-[13px] text-[#475569]">
                  <tr>{t.portalCols[lang].map((c) => <th key={c} className="px-5 py-3 font-semibold">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {stock.map((s) => (
                    <tr key={s.sku}>
                      <td className="px-5 py-3.5 font-semibold">{s.sku}</td>
                      <td className="px-5 py-3.5 tabular-nums">{s.avail}</td>
                      <td className="px-5 py-3.5 tabular-nums">{s.inbound}</td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.low ? "bg-[#FFEDD5] text-[#9A3412]" : "bg-[#DCFCE7] text-[#166534]"}`}>
                          {pick(s.low ? t.stockLow : t.stockOk, lang)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section id="location" className="bg-white py-24">
        <div className={`${wrap} flex flex-wrap gap-12`}>
          <div className="grid h-80 min-w-0 flex-[1_1_480px] place-items-center rounded-2xl bg-[#EEF2F8] font-semibold text-[#475569]">[ {pick(t.map, lang)} ]</div>
          <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
            <span className={C.kicker}>{pick(t.locationKicker, lang)}</span>
            <h2 className="text-3xl font-black tracking-tight">{pick(warehouse.location.city, lang)}</h2>
            <p className={`text-[17px] leading-relaxed ${C.muted}`}>{pick(warehouse.location.note, lang)}</p>
            <div className="flex flex-col gap-2 text-base">
              <span><b>{pick(t.address, lang)}：</b>{warehouse.location.address}</span>
              {warehouse.contact.wechat && <span><b>{pick(t.contact.wechat, lang)}：</b>{warehouse.contact.wechat}</span>}
              <span><b>{pick(t.contact.hours, lang)}：</b>{pick(warehouse.contact.hours, lang)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-[#D9480F] py-16 text-white">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-6`}>
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-black">{pick(t.ctaTitle, lang)}</h2>
            <p className="text-[17px] text-[#FFE8DC]">{pick(t.ctaBody, lang)}</p>
          </div>
          <Link href={withLang("/quote", lang)} className="rounded-xl bg-white px-7 py-4 text-[17px] font-extrabold text-[#0B1F3A] transition active:scale-95">
            {pick(t.nav.quote, lang)} →
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
