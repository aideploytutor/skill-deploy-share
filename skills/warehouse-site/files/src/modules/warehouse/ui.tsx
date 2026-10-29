import Link from "next/link";
import type { ReactNode } from "react";
import { type IconName, type Lang, pick, t, warehouse } from "./config";

/**
 * warehouse-site (episode 022): header, footer, icons and colors shared by the public pages.
 * Colors: navy for trust, one orange for actions. Change them here.
 */
export const C = {
  navy: "bg-[#0B1F3A]",
  navyText: "text-[#0B1F3A]",
  orangeBtn: "bg-[#D9480F] text-white hover:bg-[#C2410C]",
  kicker: "text-sm font-bold tracking-wide text-[#D9480F]",
  muted: "text-[#475569]",
  line: "border-[#E2E8F0]",
  soft: "bg-[#F5F7FA]",
};

export function withLang(href: string, lang: Lang): string {
  if (lang !== "en") return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}lang=en${hash ? `#${hash}` : ""}`;
}

const PATHS: Record<IconName, ReactNode> = {
  box: <><path d="M21 8l-9-5-9 5 9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  truck: <><rect x="1" y="7" width="14" height="10" rx="1" /><path d="M15 10h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  return: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  tag: <><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  home: <><path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M8 20v-7h8v7" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
};

export function Icon({ name, size = 24, color = "currentColor" }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function SiteShell({ lang, path, children }: { lang: Lang; path: string; children: ReactNode }) {
  const N = t.nav;
  const home = path === "/" ? "" : "/";
  const links = [
    { href: `${home}#services`, label: pick(N.services, lang) },
    { href: `${home}#pricing`, label: pick(N.pricing, lang) },
    { href: `${home}#how`, label: pick(N.how, lang) },
    { href: `${home}#location`, label: pick(N.location, lang) },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-white font-sans text-[#0F172A]">
      <header className={`${C.navy} text-white`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href={withLang("/", lang)} className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <span className="grid size-9 place-items-center rounded-lg bg-[#D9480F]">
              <Icon name="home" size={20} color="#FFFFFF" />
            </span>
            {warehouse.name}
          </Link>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] font-medium text-[#CBD5E1]">
            {links.map((l) => (
              <Link key={l.href} href={withLang(l.href || "/", lang)} className="hover:text-white">
                {l.label}
              </Link>
            ))}
            <Link
              href={lang === "en" ? path : `${path}?lang=en`}
              className="rounded-md border border-[#334A6E] px-2.5 py-1 text-xs hover:text-white"
              aria-label={lang === "en" ? "切换到中文" : "Switch to English"}
            >
              {lang === "en" ? "中文" : "EN"}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login?next=/admin/inquiries" className="rounded-lg border border-[#4B6185] px-4 py-2.5 text-[15px] font-semibold hover:bg-white/5">
              {pick(N.login, lang)}
            </Link>
            <Link href={withLang("/quote", lang)} className={`rounded-lg px-4 py-2.5 text-[15px] font-bold ${C.orangeBtn}`}>
              {pick(N.quote, lang)}
            </Link>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="bg-[#08172C] text-[#94A3B8]">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 py-8 text-sm sm:px-8">
          <span>
            © {new Date().getFullYear()} {warehouse.name}
          </span>
          <span>{pick(t.footer, lang)}</span>
        </div>
      </footer>
    </div>
  );
}
