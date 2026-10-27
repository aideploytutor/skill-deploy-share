import type { Metadata } from "next";
import { langFrom, pick, t } from "@/modules/warehouse/config";
import { C, SiteShell } from "@/modules/warehouse/ui";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = { title: "Quote · 报价" };

/** warehouse-site (episode 015): sellers estimate their monthly cost themselves, any time of day. */
export default async function QuotePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = langFrom((await searchParams).lang);
  return (
    <SiteShell lang={lang} path="/quote">
      <main className={`${C.soft} min-h-full`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:px-8">
          <header className="flex flex-col gap-2.5">
            <span className={C.kicker}>{pick(t.quote.kicker, lang)}</span>
            <h1 className="text-3xl font-black tracking-tight sm:text-[44px]">{pick(t.quote.title, lang)}</h1>
            <p className={`text-[17px] ${C.muted}`}>{pick(t.quote.lede, lang)}</p>
          </header>
          <QuoteForm lang={lang} />
        </div>
      </main>
    </SiteShell>
  );
}
