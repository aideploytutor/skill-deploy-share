import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { isDbConfigured } from "@/db";
import { opsAccess } from "@/modules/ops/access";
import { type Day, lastDays, loadOps } from "@/modules/ops/metrics";

export const metadata: Metadata = { title: "Ops dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

const T = {
  en: {
    home: "← Home", title: "Ops dashboard", sub: "Sign-ups, money, email and health, straight from your own database.",
    public: "Public demo · numbers only, no personal data", owner: "Owner view", period: (d: number, tz: string) => `Last ${d} days · ${tz}`,
    users: "New users · 7 days", usersSub: (t: number, d: number) => `${t} total · +${d} in 24 h`,
    revenue: "Revenue · 7 days", revenueSub: (n: number, m: string) => `${m === "test" ? "Test" : "Live"} mode · paid orders only`,
    subs: "Payments · 7 days", subsSub: (a: number, r: number) => `${a} active subscriptions · ${r} refunds`,
    emails: "Emails sent · 7 days", emailsSub: (f: number) => (f ? `${f} failed` : "none failed"),
    perDay: "per day", today: "today",
    health: "Health", healthSub: "Green means nothing to do.",
    db: "Database", dbOk: (ms: number) => `Answering in ${ms} ms`,
    backup: "Nightly backup", backupAgo: (a: string) => `Last one ${a}`, backupOld: (a: string) => `Last one ${a}: check the GitHub Action`, backupNone: "Not set up (db-backup)",
    hooks: "Payment notifications", hooksOk: (n: number) => `${n} received in 7 days, none failed`, hooksBad: (f: number, n: number) => `${f} of ${n} failed: open Creem → Webhooks → Resend`, hooksNone: "None in 7 days",
    mail: "Email delivery", mailOk: "No failures in 7 days", mailBad: (f: number) => `${f} failed in 7 days`,
    activity: "What happened · 7 days", latest: "Latest events", none: "Nothing yet.",
    ok: "OK", warn: "Check", idle: "Off",
    locked: "Owner only", notSet: "Add OPS_ADMIN_EMAILS (your sign-in email) in your host's variables to open this page.",
    signIn: "Sign in with the owner email to see the dashboard.", notOwner: "This page is for the site owner only.", signInBtn: "Sign in →",
    noDb: "Connect a database first (db-connect).", error: "Couldn't load the numbers. Try again in a minute.",
    foot: "This page is the ops-dashboard skill, episode 15. No tracking script, no extra account.",
  },
  zh: {
    home: "← 首页", title: "运营看板", sub: "注册、收入、邮件、健康状况，直接从你自己的数据库里读。",
    public: "公开演示 · 只有数字，不含任何个人信息", owner: "站长视图", period: (d: number, tz: string) => `最近 ${d} 天 · ${tz}`,
    users: "新用户 · 7 天", usersSub: (t: number, d: number) => `累计 ${t} · 24 小时 +${d}`,
    revenue: "收入 · 7 天", revenueSub: (n: number, m: string) => `${m === "test" ? "测试" : "正式"}模式 · 只算已付款`,
    subs: "付款笔数 · 7 天", subsSub: (a: number, r: number) => `有效订阅 ${a} 个 · 退款 ${r} 笔`,
    emails: "发出邮件 · 7 天", emailsSub: (f: number) => (f ? `${f} 封失败` : "没有失败"),
    perDay: "每天", today: "今天",
    health: "健康检查", healthSub: "全绿就不用管。",
    db: "数据库", dbOk: (ms: number) => `${ms} 毫秒响应`,
    backup: "每晚备份", backupAgo: (a: string) => `上次 ${a}`, backupOld: (a: string) => `上次 ${a}，去看看 GitHub Action`, backupNone: "还没设置（db-backup）",
    hooks: "付款通知", hooksOk: (n: number) => `7 天收到 ${n} 条，全部成功`, hooksBad: (f: number, n: number) => `${n} 条里 ${f} 条失败：去 Creem → Webhooks 点 Resend`, hooksNone: "7 天内没有",
    mail: "邮件送达", mailOk: "7 天内没有失败", mailBad: (f: number) => `7 天内 ${f} 封失败`,
    activity: "7 天里发生了什么", latest: "最新事件", none: "还没有。",
    ok: "正常", warn: "要看", idle: "未开",
    locked: "仅站长可见", notSet: "在网站后台变量里加上 OPS_ADMIN_EMAILS（你登录用的邮箱）就能打开这一页。",
    signIn: "用站长邮箱登录后才能看。", notOwner: "这一页只有站长能看。", signInBtn: "去登录 →",
    noDb: "先连上数据库（db-connect）。", error: "数字没读出来，过一分钟再试。",
    foot: "这一页就是第 15 期的 ops-dashboard skill。不装统计代码，不用注册新账号。",
  },
};
type Lang = keyof typeof T;

// Kept here (not imported from pay-checkout) so the page also works on sites that don't take payments yet.
const payMode = (): "test" | "live" => ((process.env.CREEM_API_KEY ?? "").startsWith("creem_test_") || !process.env.CREEM_API_KEY ? "test" : "live");
function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function ago(d: Date, lang: Lang): string {
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 60) return lang === "zh" ? `${m} 分钟前` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return lang === "zh" ? `${h} 小时前` : `${h} h ago`;
  const dd = Math.round(h / 24);
  return lang === "zh" ? `${dd} 天前` : `${dd} days ago`;
}

/** One series, one bar per day. Hover a bar for its date and value. */
function Bars({ days, pick, label, fmt }: { days: Day[]; pick: (d: Day) => number; label: string; fmt: (v: number) => string }) {
  const vals = days.map(pick);
  const max = Math.max(1, ...vals);
  const H = 56, step = 12, w = 9;
  const W = days.length * step;
  return (
    <svg viewBox={`0 0 ${W} ${H + 2}`} className="h-12 w-full sm:h-16" preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2={W} y1={H + 1} y2={H + 1} className="stroke-line" strokeWidth="1" />
      {vals.map((v, i) => {
        const h = v ? Math.max(3, (v / max) * H) : 0;
        const x = i * step + (step - w) / 2;
        const y = H - h;
        const r = Math.min(2, h / 2);
        const today = i === vals.length - 1;
        return (
          <g key={days[i].day}>
            <title>{`${days[i].day}: ${fmt(v)}`}</title>
            <rect x={i * step} y="0" width={step} height={H + 2} fill="transparent" />
            {h > 0 && (
              <path d={`M${x} ${H}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${H}Z`}
                className={today ? "fill-accent" : "fill-ink/80"} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Tile({ label, value, sub, children }: { label: string; value: string; sub: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-white p-4 sm:p-5 dark:bg-white/5">
      <h2 className="text-[13px] font-bold text-muted sm:text-sm">{label}</h2>
      <p className="text-[26px] font-black leading-tight tabular-nums sm:text-[34px]">{value}</p>
      <p className="text-xs text-muted sm:text-sm">{sub}</p>
      <div className="mt-auto pt-3">{children}</div>
    </section>
  );
}

type Tone = "ok" | "warn" | "idle";
const TONE: Record<Tone, { cls: string; icon: string }> = {
  ok: { cls: "bg-[#DCFCE7] text-[#166534]", icon: "✓" },
  warn: { cls: "bg-[#FFEDD5] text-[#9A3412]", icon: "!" },
  idle: { cls: "bg-line/70 text-muted", icon: "–" },
};

export default async function OpsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = (sp.lang ?? (await cookies()).get("lang")?.value) === "zh" ? "zh" : "en";
  const t = T[lang];
  const tz = process.env.OPS_TIMEZONE || "UTC";
  const access = await opsAccess(await headers());

  const shell = (body: ReactNode) => (
    <div className="min-h-dvh bg-paper text-ink">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm font-bold text-muted hover:text-ink">{t.home}</Link>
            <nav aria-label="Language" className="flex rounded-xl border border-line bg-white p-[3px] dark:bg-white/5">
              {(["en", "zh"] as const).map((l) => (
                <Link key={l} href={`/lang?to=${l}&next=/ops`} aria-current={lang === l ? "true" : undefined}
                  className={`rounded-lg px-2.5 py-1.5 text-[13px] font-extrabold ${lang === l ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
                  {l === "en" ? "EN" : "中文"}
                </Link>
              ))}
            </nav>
          </div>
          <h1 className="text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">{t.title}</h1>
          <p className="max-w-2xl text-[17px] text-muted">{t.sub}</p>
        </header>
        {body}
        <footer className="border-t border-line pt-5 text-sm text-muted">
          {t.foot}{" "}
          <a className="font-bold underline underline-offset-4" href="https://github.com/aideploytutor/skill-deploy-share/tree/main/skills/ops-dashboard" target="_blank" rel="noreferrer">
            github.com/aideploytutor/skill-deploy-share
          </a>
        </footer>
      </main>
    </div>
  );

  if (!access.ok) {
    const msg = access.reason === "notSet" ? t.notSet : access.reason === "signIn" ? t.signIn : t.notOwner;
    return shell(
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-white p-6 dark:bg-white/5">
        <span className="rounded-full bg-line/70 px-3 py-1 text-xs font-extrabold text-muted">{t.locked}</span>
        <p className="text-lg">{msg}</p>
        {access.reason === "signIn" && (
          <Link href="/login?next=/ops" className="rounded-xl bg-ink px-4 py-3 font-extrabold text-paper">{t.signInBtn}</Link>
        )}
      </section>,
    );
  }
  if (!isDbConfigured()) return shell(<p className="text-lg">{t.noDb}</p>);

  const mode = payMode();
  let o: Awaited<ReturnType<typeof loadOps>>;
  try {
    o = await loadOps({ days: 14, timeZone: tz, payMode: mode });
  } catch (e) {
    console.error("[ops] load failed:", e instanceof Error ? e.message : e);
    return shell(<p className="text-lg">{t.error}</p>);
  }

  const money = (v: number) => formatMoney(v, o.currency ?? "USD");
  const num = (v: number) => String(v);

  const backupHours = o.lastBackup ? (Date.now() - o.lastBackup.getTime()) / 3.6e6 : null;
  const health: { name: string; tone: Tone; text: string }[] = [
    { name: t.db, tone: "ok", text: t.dbOk(o.dbMs) },
    backupHours === null
      ? { name: t.backup, tone: "idle", text: t.backupNone }
      : backupHours <= 36
        ? { name: t.backup, tone: "ok", text: t.backupAgo(ago(o.lastBackup!, lang)) }
        : { name: t.backup, tone: "warn", text: t.backupOld(ago(o.lastBackup!, lang)) },
    !o.has.webhook || o.webhooks7d === 0
      ? { name: t.hooks, tone: "idle", text: t.hooksNone }
      : o.webhookFailed7d
        ? { name: t.hooks, tone: "warn", text: t.hooksBad(o.webhookFailed7d, o.webhooks7d) }
        : { name: t.hooks, tone: "ok", text: t.hooksOk(o.webhooks7d) },
    o.emailFailed7d ? { name: t.mail, tone: "warn", text: t.mailBad(o.emailFailed7d) } : { name: t.mail, tone: "ok", text: t.mailOk },
  ];
  const topMax = Math.max(1, ...o.topTypes.map((x) => x.n));
  const first = o.days[0]?.day.slice(5) ?? "";

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`rounded-full px-3 py-1.5 text-[13px] font-extrabold ${access.public ? "bg-[#FFEDD5] text-[#9A3412]" : "bg-ink text-paper"}`}>
          {access.public ? t.public : t.owner}
        </span>
        <span className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted">{t.period(o.days.length, tz)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label={t.users} value={num(lastDays(o.days, "signups"))} sub={t.usersSub(o.users, o.users24h)}>
          <Bars days={o.days} pick={(d) => d.signups} label={t.users} fmt={num} />
        </Tile>
        <Tile label={t.revenue} value={money(lastDays(o.days, "revenue"))} sub={t.revenueSub(lastDays(o.days, "paid"), mode)}>
          <Bars days={o.days} pick={(d) => d.revenue} label={t.revenue} fmt={money} />
        </Tile>
        <Tile label={t.subs} value={num(lastDays(o.days, "paid"))} sub={t.subsSub(o.activeSubs, o.refunds7d)}>
          <Bars days={o.days} pick={(d) => d.paid} label={t.subs} fmt={num} />
        </Tile>
        <Tile label={t.emails} value={num(lastDays(o.days, "emails"))} sub={t.emailsSub(o.emailFailed7d)}>
          <Bars days={o.days} pick={(d) => d.emails} label={t.emails} fmt={num} />
        </Tile>
      </div>
      <p className="-mt-5 flex justify-between text-xs text-muted">
        <span>{first} · {t.perDay}</span>
        <span className="font-bold text-accent">■ {t.today}</span>
      </p>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-2xl font-black">{t.health}</h2>
          <span className="text-sm text-muted">{t.healthSub}</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {health.map((h) => (
            <li key={h.name} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 dark:bg-white/5">
              <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-extrabold ${TONE[h.tone].cls}`}>
                {TONE[h.tone].icon} {t[h.tone]}
              </span>
              <div className="min-w-0">
                <p className="font-extrabold">{h.name}</p>
                <p className="text-sm text-muted">{h.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 dark:bg-white/5">
          <h2 className="text-lg font-black">{t.activity}</h2>
          {o.topTypes.length === 0 && <p className="text-muted">{t.none}</p>}
          <ul className="flex flex-col gap-2.5">
            {o.topTypes.map((x) => (
              <li key={x.type} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm" title={`${x.type}: ${x.n}`}>
                <code className="truncate">{x.type}</code>
                <span className="h-2.5 rounded-r bg-ink/80" style={{ width: `${Math.max(3, (x.n / topMax) * 100)}%` }} />
                <span className="text-right font-bold tabular-nums">{x.n}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 dark:bg-white/5">
          <h2 className="text-lg font-black">{t.latest}</h2>
          {o.recent.length === 0 && <p className="text-muted">{t.none}</p>}
          <ul className="flex flex-col divide-y divide-line">
            {o.recent.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <code className="font-bold">{e.type}</code>
                  {e.times > 1 && <span className="ml-1.5 rounded-full bg-line/70 px-1.5 py-0.5 text-xs font-bold">×{e.times}</span>}
                  <span className="text-muted"> · {e.source}</span>
                </span>
                <span className="flex-none text-muted tabular-nums">{ago(e.at, lang)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>,
  );
}
