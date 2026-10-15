import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { isEmailConfigured, maskEmail, sendEmail } from "@/lib/email";
import stack from "../../../stack.json";

export const metadata: Metadata = { title: "邮件测试" };
export const dynamic = "force-dynamic";

// This page is public, so it can only ever email the owner (EMAIL_TEST_TO),
// at most once a minute and 10 times a day.
const COOLDOWN_S = 60;
const DAILY_CAP = 10;

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

async function sendTest() {
  "use server";
  const to = process.env.EMAIL_TEST_TO;
  if (!isEmailConfigured() || !to) redirect("/email-test?r=config");
  if ((await recentTests(COOLDOWN_S)) > 0) redirect("/email-test?r=wait");
  if ((await recentTests(86400)) >= DAILY_CAP) redirect("/email-test?r=cap");

  const site = process.env.NEXT_PUBLIC_SITE_NAME || stack.name || "我的网站";
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const time = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const r = await sendEmail({
    to,
    tag: "test",
    subject: `【${site}】测试邮件：网站已经能发邮件了`,
    text: `这是一封测试邮件，发送时间 ${time}。\n收到它，说明你的网站已经能用自己的域名发邮件了。\n${url}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6">
      <p>这是一封测试邮件，发送时间 ${time}。</p>
      <p>收到它，说明你的网站已经能用<b>自己的域名</b>发邮件了。</p>
      ${url ? `<p><a href="${url}">${url}</a></p>` : ""}
    </div>`,
  });
  redirect(r.ok ? "/email-test?r=ok" : `/email-test?r=fail&e=${encodeURIComponent(r.error.slice(0, 200))}`);
}

const MESSAGES: Record<string, [string, string]> = {
  ok: ["✅ 已发送", "去邮箱看看，记得也看一眼垃圾箱。"],
  wait: ["⏳ 稍等一下", `每 ${COOLDOWN_S} 秒最多发一封。`],
  cap: ["今天的测试次数用完了", `每天最多 ${DAILY_CAP} 封测试邮件。`],
  config: ["还没配置好", "按下面的清单把环境变量补齐，然后重新部署。"],
  fail: ["❌ 发送失败", ""],
};

export default async function EmailTestPage({ searchParams }: { searchParams: Promise<{ r?: string; e?: string }> }) {
  const { r, e } = await searchParams;
  const from = process.env.EMAIL_FROM ?? "";
  const to = process.env.EMAIL_TEST_TO ?? "";
  const checks: [string, boolean, string][] = [
    ["RESEND_API_KEY", Boolean(process.env.RESEND_API_KEY), "Resend 的发信密钥（只放在 Vercel，别发给任何人）"],
    ["EMAIL_FROM", Boolean(from), from ? from : "发件人，比如 我的小店 <hello@mail.你的域名.com>"],
    ["EMAIL_TEST_TO", Boolean(to), to ? maskEmail(to) : "测试邮件寄到哪（你自己的邮箱）"],
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

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">email-send</span>
        <h1 className="text-3xl font-black">邮件测试</h1>
        <p className="text-muted">点一下按钮，网站会用你自己的域名给你发一封测试邮件。这个页面只会寄给你自己。</p>
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

      <form action={sendTest}>
        <button
          type="submit"
          disabled={!isEmailConfigured() || !to}
          className="rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95 disabled:opacity-40"
        >
          给我发一封测试邮件
        </button>
      </form>

      {log.length > 0 && (
        <section className="rounded-2xl border border-line p-5">
          <h2 className="mb-3 font-bold">最近发送</h2>
          <ol className="flex flex-col divide-y divide-line">
            {log.map((row) => {
              const p = row.payload as { to?: string[]; subject?: string; tag?: string };
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
