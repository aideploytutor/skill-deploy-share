import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, gt, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { isEmailConfigured, maskEmail, sendEmail } from "@/lib/email";
import stack from "../../../stack.json";

export const metadata: Metadata = { title: "Email test" };
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

  const site = process.env.NEXT_PUBLIC_SITE_NAME || stack.name || "My Site";
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const time = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const r = await sendEmail({
    to,
    tag: "test",
    subject: `[${site}] Test email: your site can send email`,
    text: `This is a test email, sent at ${time}.\nIf you got it, this site can now send email from its own domain.\n${url}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6">
      <p>This is a test email, sent at ${time}.</p>
      <p>If you got it, this site can now send email from <b>its own domain</b>.</p>
      ${url ? `<p><a href="${url}">${url}</a></p>` : ""}
    </div>`,
  });
  // The address is never put in the URL; the page shows it masked from the send log.
  redirect(r.ok ? "/email-test?r=ok" : `/email-test?r=fail&e=${encodeURIComponent(r.error.slice(0, 200))}`);
}

const MESSAGES: Record<string, [string, string]> = {
  ok: ["✅ Sent", "Check the inbox, and the spam folder too."],
  wait: ["⏳ Hold on", `One email every ${COOLDOWN_S} seconds at most.`],
  cap: ["No test emails left today", `At most ${DAILY_CAP} test emails a day.`],
  config: ["Not set up yet", "Add the environment variables in the checklist below, then redeploy."],
  noto: ["Send to whom?", "Enter a recipient email first."],
  bad: ["That email doesn't look right", "Check for extra spaces or a missing @."],
  nocode: ["You can only send to yourself", "To send to other addresses, set a test code EMAIL_TEST_CODE in Vercel, then redeploy."],
  code: ["Wrong test code", "Sending to other addresses needs the correct test code."],
  fail: ["❌ Sending failed", ""],
};

export default async function EmailTestPage({ searchParams }: { searchParams: Promise<{ r?: string; e?: string }> }) {
  const { r, e } = await searchParams;
  const from = process.env.EMAIL_FROM ?? "";
  const owner = process.env.EMAIL_TEST_TO ?? "";
  const hasCode = Boolean(process.env.EMAIL_TEST_CODE);
  const checks: [string, boolean, string][] = [
    ["RESEND_API_KEY", Boolean(process.env.RESEND_API_KEY), "Resend sending key (only in Vercel, never share it)"],
    ["EMAIL_FROM", Boolean(from), from || "Sender, e.g. My Shop <hello@mail.example.com>"],
    ["EMAIL_TEST_TO", Boolean(owner), owner ? `${maskEmail(owner)} (used when no recipient is entered)` : "Optional: your own email, used when no recipient is entered"],
    ["EMAIL_TEST_CODE", hasCode, hasCode ? (owner ? "Set: needed to send to other addresses" : "Set: needed to send") : "Optional: set it to send to other addresses"],
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
        <h1 className="text-3xl font-black">Email test</h1>
        <p className="text-muted">Enter an email address and the site will send it a test email from your own domain.{owner ? " Leave it empty to send to yourself." : ""}</p>
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
          <span className="text-sm font-bold">Recipient</span>
          <input
            name="to"
            type="email"
            autoComplete="off"
            placeholder={owner ? `Empty sends to ${maskEmail(owner)}` : "name@example.com"}
            required={!owner}
            className="rounded-xl border border-line bg-transparent px-4 py-3"
          />
        </label>
        {hasCode && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">Test code <span className="font-normal text-muted">{owner ? "(only needed for other addresses)" : ""}</span></span>
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
          Send a test email
        </button>
        <p className="text-xs text-muted">
          So nobody can use your domain to send spam: {owner ? "sending to anyone but you" : "sending"} needs the test code; at most 1 email every {COOLDOWN_S} seconds and {DAILY_CAP} a day; the content is fixed.
        </p>
      </form>

      {log.length > 0 && (
        <section className="rounded-2xl border border-line p-5">
          <h2 className="mb-3 font-bold">Recently sent</h2>
          <ol className="flex flex-col divide-y divide-line">
            {log.map((row) => {
              const p = row.payload as { to?: string[]; tag?: string };
              return (
                <li key={row.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {row.type === "email.sent" ? "✅" : "❌"} {p.to?.join(", ")} <span className="text-muted">· {p.tag ?? "—"}</span>
                  </span>
                  <time className="shrink-0 tabular-nums text-muted">
                    {row.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
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
