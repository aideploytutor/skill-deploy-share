import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";

/**
 * ops-dashboard (episode 015): every number on /ops, read from tables other skills already write.
 * Read-only: this module never inserts or updates anything.
 * Tables that are not installed yet (no payments, no uploads…) count as 0 instead of failing.
 */

export type Day = { day: string; signups: number; paid: number; revenue: number; emails: number; events: number };

export type Ops = {
  days: Day[];
  users: number;
  users24h: number;
  activeSubs: number;
  refunds7d: number;
  webhooks7d: number;
  webhookFailed7d: number;
  emailFailed7d: number;
  files: number;
  lastBackup: Date | null;
  currency: string | null;
  dbMs: number;
  recent: { type: string; source: string; at: Date; times: number }[];
  topTypes: { type: string; n: number }[];
  has: Record<"auth" | "pay" | "subs" | "webhook" | "grants" | "files", boolean>;
};

const n = (v: unknown) => Number(v ?? 0) || 0;
const yes = (v: unknown) => v === true || v === "t" || v === "true";

/** Which optional tables exist, so the same page works on a fresh foundation and on a full shop. */
async function installedTables() {
  const [r] = await getDb().execute<Record<string, unknown>>(sql`
    select to_regclass('public.auth_users') is not null as auth,
           to_regclass('public.pay_payments') is not null as pay,
           to_regclass('public.pay_subscriptions') is not null as subs,
           to_regclass('public.pay_webhook_events') is not null as webhook,
           to_regclass('public.pay_grants') is not null as grants,
           to_regclass('public.files_uploads') is not null as files`);
  return { auth: yes(r?.auth), pay: yes(r?.pay), subs: yes(r?.subs), webhook: yes(r?.webhook), grants: yes(r?.grants), files: yes(r?.files) };
}

export async function loadOps(opts: { days?: number; timeZone?: string; payMode?: "test" | "live" } = {}): Promise<Ops> {
  const db = getDb();
  const span = Math.min(Math.max(opts.days ?? 14, 7), 60);
  const tz = opts.timeZone || "UTC";
  const mode = opts.payMode ?? "test";

  const t0 = Date.now();
  const has = await installedTables();
  const dbMs = Date.now() - t0;

  const zero = sql`0`;
  const local = (col: SQL) => sql`(${col} at time zone ${tz})::date`;

  const days = await db.execute<Record<string, unknown>>(sql`
    with d as (
      select generate_series((now() at time zone ${tz})::date - ${span - 1}::int, (now() at time zone ${tz})::date, interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
      ${has.auth ? sql`(select count(*) from auth_users u where ${local(sql`u.created_at`)} = d.day)` : zero} as signups,
      ${has.pay ? sql`(select count(*) from pay_payments p where p.status = 'paid' and p.mode = ${mode} and ${local(sql`p.paid_at`)} = d.day)` : zero} as paid,
      ${has.pay ? sql`(select coalesce(sum(p.amount), 0) from pay_payments p where p.status = 'paid' and p.mode = ${mode} and ${local(sql`p.paid_at`)} = d.day)` : zero} as revenue,
      (select count(*) from core_events e where e.type = 'email.sent' and ${local(sql`e.created_at`)} = d.day) as emails,
      (select count(*) from core_events e where ${local(sql`e.created_at`)} = d.day) as events
    from d order by d.day`);

  const [t] = await db.execute<Record<string, unknown>>(sql`
    select
      ${has.auth ? sql`(select count(*) from auth_users)` : zero} as users,
      ${has.auth ? sql`(select count(*) from auth_users where created_at > now() - interval '24 hours')` : zero} as users24h,
      ${has.subs ? sql`(select count(*) from pay_subscriptions where mode = ${mode} and status in ('active', 'trialing', 'past_due', 'scheduled_cancel'))` : zero} as subs,
      ${has.grants ? sql`(select count(*) from pay_grants where revoked_at > now() - interval '7 days')` : zero} as refunds,
      ${has.webhook ? sql`(select count(*) from pay_webhook_events where received_at > now() - interval '7 days')` : zero} as webhooks,
      ${has.webhook ? sql`(select count(*) from pay_webhook_events where status = 'failed' and received_at > now() - interval '7 days')` : zero} as webhook_failed,
      (select count(*) from core_events where type = 'email.failed' and created_at > now() - interval '7 days') as email_failed,
      ${has.files ? sql`(select count(*) from files_uploads)` : zero} as files,
      (select max(created_at) from core_events where type = 'db.backed_up') as last_backup,
      ${has.pay ? sql`(select currency from pay_payments where status = 'paid' order by paid_at desc nulls last limit 1)` : sql`null`} as currency`);

  // Only the event name, who sent it and when: never the payload or subject id, which can hold emails.
  const recent = await db.execute<Record<string, unknown>>(sql`
    select type, source, created_at from core_events order by created_at desc limit 60`);
  const top = await db.execute<Record<string, unknown>>(sql`
    select type, count(*) as n from core_events where created_at > now() - interval '7 days'
    group by type order by count(*) desc limit 8`);

  return {
    days: [...days].map((r) => ({
      day: String(r.day), signups: n(r.signups), paid: n(r.paid), revenue: n(r.revenue), emails: n(r.emails), events: n(r.events),
    })),
    users: n(t?.users),
    users24h: n(t?.users24h),
    activeSubs: n(t?.subs),
    refunds7d: n(t?.refunds),
    webhooks7d: n(t?.webhooks),
    webhookFailed7d: n(t?.webhook_failed),
    emailFailed7d: n(t?.email_failed),
    files: n(t?.files),
    lastBackup: t?.last_backup ? new Date(String(t.last_backup)) : null,
    currency: t?.currency ? String(t.currency) : null,
    dbMs,
    recent: collapse([...recent].map((r) => ({ type: String(r.type), source: String(r.source), at: new Date(String(r.created_at)), times: 1 }))).slice(0, 10),
    topTypes: [...top].map((r) => ({ type: String(r.type), n: n(r.n) })),
    has,
  };
}

/** Hourly jobs (e.g. pay.reconciled) would fill the feed: repeats in a row become one line with a count. */
function collapse<T extends { type: string; times: number }>(rows: T[]): T[] {
  const out: T[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.type === r.type) last.times += 1;
    else out.push({ ...r });
  }
  return out;
}

/** Sum of the last `k` days of one series. */
export const lastDays = (days: Day[], key: keyof Omit<Day, "day">, k = 7) => days.slice(-k).reduce((s, d) => s + d[key], 0);
