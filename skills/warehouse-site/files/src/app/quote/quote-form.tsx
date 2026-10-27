"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type Lang, money, pick, t } from "@/modules/warehouse/config";
import { estimate, type QuoteInput } from "@/modules/warehouse/quote";

/** warehouse-site (episode 015): live quote calculator. The same math runs again on the server when the seller sends it. */
const START: QuoteInput = { lengthIn: 10, widthIn: 8, heightIn: 4, weightLb: 2, ordersPerMonth: 1000, itemsPerOrder: 1, unitsStored: 2000, unitsInbound: 1000 };

const box = "flex flex-col gap-5 rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-7";
const legend = "px-1.5 text-lg font-extrabold";

export function QuoteForm({ lang }: { lang: Lang }) {
  const [v, setV] = useState<QuoteInput>(START);
  const q = useMemo(() => estimate(v), [v]);
  const L = t.quote;
  const field = (key: keyof QuoteInput, label: string, step = "any") => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#475569]">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={v[key] ? v[key] : ""}
        placeholder="0"
        onChange={(e) => setV({ ...v, [key]: e.target.value === "" ? 0 : Number(e.target.value) })}
        className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-3 text-[17px] font-normal tabular-nums text-[#0F172A] outline-none focus:border-[#0B1F3A] focus:ring-2 focus:ring-[#0B1F3A]/15"
      />
    </label>
  );
  const line = (label: string, value: number) => (
    <div className="flex justify-between gap-4 border-t border-[#263F66] py-3">
      <span className="text-[#CBD5E1]">{label}</span>
      <span className="font-bold tabular-nums">{money(value)}</span>
    </div>
  );

  return (
    <div className="flex flex-wrap items-start gap-7">
      <div className="flex min-w-0 flex-[999_1_540px] flex-col gap-5">
        <fieldset className={box}>
          <legend className={legend}>{pick(L.product, lang)}</legend>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {field("lengthIn", pick(L.length, lang))}
            {field("widthIn", pick(L.width, lang))}
            {field("heightIn", pick(L.height, lang))}
            {field("weightLb", pick(L.weight, lang))}
          </div>
          {q.oversize && <p className="text-sm font-bold text-[#C2410C]">⚠ {pick(L.oversizeHint, lang)}</p>}
        </fieldset>
        <fieldset className={box}>
          <legend className={legend}>{pick(L.volume, lang)}</legend>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {field("ordersPerMonth", pick(L.orders, lang), "1")}
            {field("itemsPerOrder", pick(L.itemsPerOrder, lang))}
            {field("unitsStored", pick(L.stored, lang), "1")}
            {field("unitsInbound", pick(L.inbound, lang), "1")}
          </div>
        </fieldset>
      </div>

      <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 rounded-2xl bg-[#0B1F3A] p-7 text-white lg:sticky lg:top-6" aria-live="polite">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[#CBD5E1]">{pick(L.result, lang)}</span>
          <span className="text-5xl font-extrabold leading-tight tracking-tight tabular-nums">{money(q.total)}</span>
          <span className="text-[15px] text-[#CBD5E1]">
            {pick(L.perOrder, lang)} <b className="text-white">{money(q.perOrder)}</b>
          </span>
        </div>
        <div className="flex flex-col border-b border-[#263F66] text-[15px]">
          {line(pick(L.receiving, lang), q.receiving)}
          {line(pick(L.storage, lang), q.storage)}
          {line(pick(L.pick, lang), q.pick)}
          {q.oversizeFee > 0 && line(pick(L.oversize, lang), q.oversizeFee)}
          {q.minimumTopUp > 0 && line(pick(L.minimum, lang), q.minimumTopUp)}
        </div>
        <span className="text-[13px] text-[#94A3B8]">{pick(L.excl, lang)}</span>
        <Link
          href={`/contact?q=${encodeURIComponent(JSON.stringify(q.input))}${lang === "en" ? "&lang=en" : ""}`}
          className="rounded-xl bg-[#D9480F] p-4 text-center text-[17px] font-extrabold text-white transition hover:bg-[#C2410C] active:scale-95"
        >
          {pick(L.cta, lang)}
        </Link>
        <span className="text-sm text-[#CBD5E1]">✓ {pick(L.reply, lang)}</span>
      </aside>
    </div>
  );
}
