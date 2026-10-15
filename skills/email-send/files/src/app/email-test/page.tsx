import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, gt, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { isEmailConfigured, maskEmail, sendEmail } from "@/lib/email";
import stack from "../../../stack.json";

export const metadata: Metadata = { title: "邮件测试" };
export const dynamic = "force-dynamic";

// This page is public. To stop strangers using your domain to email people:
// - with no access code, it only ever emails the owner (EMAIL_TEST_TO);
// - any other address needs the access code (EMAIL_TEST_CODE, set by the owner in Vercel);
// - always at most once a minute and 10 times a day, and the content is fixed.
const COOLDOWN_S = 60;
const DAILY_CAP = 10;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

async function recentTests(sinceSeconds: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const [{ n }] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(coreEvents)
    .where(and(
      inArray(coreEvents.type, ["email.sent", "email.failed"]),
      sql`${coreEvents.payload}->>'tag' = 'test'`,
      gt(coreEvents.createdAt, new Date(Date.now() - sinceSeconds * 1000)),
    ));
  return n;
}

/** Compare without leaking how many characters matched. */
function sameCode(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function sendTest(form: FormData) {
  "use server";
  const owner = process.env.EMAIL_TEST_TO ?? "";
  const code = process.env.EMAIL_TEST_CODE ?? "";
  const typed = String(form.get("to") ?? "").trim().toLowerCase();
  const to = typed || owner;

  if (!isEmailConfigured()) redirect("/email-test?r=config");
  if (!to) redirect("/email-test?r=noto");
  if (!EMAIL_RE.test(to) || to.length > 254) redirect("/email-test?r=bad");
  if (to !== owner.toLowerCase()) {
    if (!code) redirect("/email-test?r=nocode");
    if (!sameCode(String(form.get("code") ?? ""), code)) redirect("/email-test?r=code");
  }
  if ((await recentTests(COOLDOWN_S)) > 0) redirect("/email-test?r=wait");
  if ((await recentTests(86400)) >= DAILY_CAP) redirect("/email-test?r=cap");

  const site = process.env.NEXT_PUBLIC_SITE_NAME || stack.name || "我的网站";
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const time = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const r = await sendEmail({
    to,
    tag: "test",
    subject: `【${site}】测试邮件：网站已经能发邮件了`,
    text: `这是一封测试邮件，发送时间 ${time}。\n收到它，说明这个网站已经能用自己的域名发邮件了。\n${url}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6">
      <p>这是一封测试邮件，发送时间 ${time}。</p>
      <p>收到它，说明这个网站已经能用<b>自己的域名</b>发邮件了。</p>
      ${url ? `<p><a href="${url}">${url}</a></p>` : ""}
    </div>`,
  });
  // The address is never put in the URL; the page shows it masked from the send log.
  redirect(r.ok ? "/email-test?r=ok" : `/email-test?r=fail&e=${encodeURIComponent(r.error.slice(0, 200))}`);
}

const MESSAGES: Record<string, [string, string]> = {
  ok: ["✅ 已发送", "去邮箱看看，记得也看一眼垃圾箱。"],
  wait: ["⏳ 稍等一下", `每 ${COOLDOWN_S} 秒最多发一封。`],
  cap: ["今天的测试次数用完了", `每天最多 ${DAILY_CAP} 封测试邮件。`],
  config: ["还没配置好", "按下面的清单把环境变量补齐，然后重新部署。"],
  noto: ["要发给谁？", "填一个邮箱，或者在 Vercel 里设置 EMAIL_TEST_TO。"],
  bad: ["邮箱格式不对", "检查一下有没有多打空格或少了 @。"],
  nocode: ["只能发给你自己", "想发给其他邮箱，先在 Vercel 里设置测试口令 EMAIL_TEST_CODE，然后重新部署。"],
  code: ["测试口令不对", "发给其他邮箱需要正确的测试口令。"],
  fail: ["❌ 发送失败", ""],
};

export default async function EmailTestPage({ searchParams }: { searchParams: Promise<{ r?: string; e?: string }> }) {
  const { r, e } = await searchParams;
  const from = process.env.EMAIL_FROM ?? "";
  const owner = process.env.EMAIL_TEST_TO ?? "";
  const hasCode = Boolean(process.env.EMAIL_TEST_CODE);
  const checks: [string, boolean, string][] = [
    ["RESEND_API_KEY", Boolean(process.env.RESEND_API_KEY), "Resend 的发信密钥（只放在 Vercel，别发给任何人）"],
    ["EMAIL_FROM", Boolean(from), from || "发件人，比如 我的小店 <hello@mail.你的域名.com>"],
    ["EMAIL_TEST_TO", Boolean(owner), owner ? `${maskEmail(owner)}（不填收件人时发到这里）` : "你自己的邮箱：不填收件人时发到这里"],
    ["EMAIL_TEST_CODE", hasCode, hasCode ? "已设置：发给其他邮箱要输入它" : "可选：设置后才能发给其他邮箱"],
  ];

  const log = isDbConfigured()
    ? await getDb()
        .select({ id: coreEvents.id, type: coreEvents.type, payload: coreEvents.payload, createdAt: coreEvents.createdAt })
        .from(coreEvents)
        .where(inArray(coreEvents.type, ["email.sent", "email.failed"]))
        .orderBy(desc(coreEvents.createdAt))
        .limit(5)
    : [];
  const msg = r ? MESSAGES[r] : undefined;
  const ready = isEmailConfigured();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">email-send</span>
        <h1 className="text-3xl font-black">邮件测试</h1>
        <p className="text-muted">填一个邮箱，网站会用你自己的域名给它发一封测试邮件。不填就发给你自己。</p>
      </header>

      <section className="rounded-2xl border border-line">
        {checks.map(([k, ok, hint]) => (
          <div key={k} className="grid grid-cols-[1.5rem_9rem_1fr] items-baseline gap-3 border-b border-line p-4 last:border-b-0">
            <span>{ok ? "✅" : "⬜"}</span>
            <code className="text-sm">{k}</code>
            <span className="min-w-0 break-words text-sm text-muted">{hint}</span>
          </div>
        ))}
      </section>

      {msg && (
        <div className={`rounded-2xl p-4 ${r === "ok" ? "bg-accent/10" : "border border-line"}`}>
          <p className="font-bold">{msg[0]}</p>
          <p className="text-sm text-muted">{r === "fail" ? e : msg[1]}</p>
        </div>
      )}

      <form action={sendTest} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold">收件人</span>
          <input
            name="to"
            type="email"
            autoComplete="off"
            placeholder={owner ? `不填就发给 ${maskEmail(owner)}` : "name@example.com"}
            className="rounded-xl border border-line bg-transparent px-4 py-3"
          />
        </label>
        {hasCode && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">测试口令 <span className="font-normal text-muted">（发给别的邮箱时才需要）</span></span>
            <input
              name="code"
              type="password"
              autoComplete="off"
              className="rounded-xl border border-line bg-transparent px-4 py-3"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={!ready}
          className="w-fit rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95 disabled:opacity-40"
        >
          发一封测试邮件
        </button>
        <p className="text-xs text-muted">
          为了防止别人借你的域名乱发邮件：发给自己以外的邮箱需要测试口令；每 {COOLDOWN_S} 秒最多 1 封、每天最多 {DAILY_CAP} 封；邮件内容固定，不能自定义。
        </p>
      </form>

      {log.length > 0 && (
        <section className="rounded-2xl border border-line p-5">
          <h2 className="mb-3 font-bold">最近发送</h2>
          <ol className="flex flex-col divide-y divide-line">
            {log.map((row) => {
              const p = row.payload as { to?: string[]; tag?: string };
              return (
                <li key={row.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {row.type === "email.sent" ? "✅" : "❌"} {p.to?.join(", ")} <span className="text-muted">· {p.tag ?? "—"}</span>
                  </span>
                  <time className="shrink-0 tabular-nums text-muted">
                    {row.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}
