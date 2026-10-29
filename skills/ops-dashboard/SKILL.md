---
name: ops-dashboard
description: Add an owner-only ops dashboard (/ops) to a launched site — new users, revenue, payments and emails for the last 14 days with daily bars, plus health checks (database, nightly backup, payment webhooks, email delivery) and a live event feed — read straight from the site's own Postgres, with no tracking script and no outside account. Use when the user says "I launched, now what", "how many people signed up", "show me my numbers", "ops dashboard", "运营看板", "后台数据", "监控网站", or a later monitoring skill requires ops-dashboard.
license: MIT
metadata:
  version: "1.0.0"
  episode: "015"
  requires: "app-foundation, db-connect, auth-login (pay-checkout, pay-webhook, pay-subscription, email-send, file-upload, db-backup are read when present)"
  provides: "src/modules/ops/{metrics,access}.ts; /ops page; OPS_ADMIN_EMAILS, OPS_TIMEZONE, OPS_DASHBOARD_PUBLIC variables"
---

# ops-dashboard

Goal: after launch, the owner opens one page on their phone and knows in five seconds whether anyone signed up, whether money came in, and whether anything is broken. Follow `../../STACK.md`.

Why no PostHog/GA here: everything that matters at this stage is already in the database the earlier skills write (`auth_users`, `pay_payments`, `pay_subscriptions`, `pay_webhook_events`, `pay_grants`, `core_events` with `email.sent`/`email.failed`/`db.backed_up`). Reading it costs nothing, needs no sign-up, and can't be blocked by ad blockers. Visitor analytics come in a later episode.

## What it shows

| Block | Source |
|---|---|
| New users · 7 days (+ total, + last 24 h) | `auth_users.created_at` |
| Revenue · 7 days (current Creem mode only) | `pay_payments` where `status = 'paid'` |
| Payments · 7 days (+ active subscriptions, refunds) | `pay_payments`, `pay_subscriptions`, `pay_grants.revoked_at` |
| Emails sent · 7 days (+ failed) | `core_events` `email.sent` / `email.failed` |
| Health: database, nightly backup (warn after 36 h), payment webhooks (failed), email delivery | query time, `db.backed_up`, `pay_webhook_events.status`, `email.failed` |
| What happened · 7 days, Latest events | `core_events` type, source and time only |

Each tile has 14 daily bars (today in the accent colour; hover/tap a bar for its date and value). Tables that aren't installed count as 0, so it works on a bare foundation too.

## Rules

- **Read-only.** The page never writes to any table.
- **No personal data on the page.** Event payloads and subject ids are never shown (they can hold emails). Counts and sums only.
- **Owner only by default.** `OPS_ADMIN_EMAILS` (plain text, comma-separated) decides who can open `/ops` after signing in. Without it the page says how to set it and shows nothing.
- `OPS_DASHBOARD_PUBLIC=true` opens it to everyone. Only for demo sites; never suggest it for a real business.
- Days are counted in `OPS_TIMEZONE` (IANA name, default `UTC`). Use the owner's time zone so "today" matches theirs.

## Steps

### 1. Add the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

Adds `src/modules/ops/metrics.ts`, `src/modules/ops/access.ts`, `src/app/ops/page.tsx` (and `src/app/lang/route.ts` if missing), documents the variables in `.env.example`, records the install, commits. No migration.

Optional: link it from the homepage or the account page for admins.

### 2. Owner: one variable (a phone works)

Cloudflare → Workers & Pages → the worker → Settings → Variables and Secrets → Add → Text: `OPS_ADMIN_EMAILS` = the email they sign in with. Optional: `OPS_TIMEZONE` = e.g. `America/Los_Angeles`, `Asia/Shanghai`. Save (it redeploys by itself). On Vercel: Settings → Environment Variables, then redeploy.

### 3. Verify

1. Signed out, `/ops` says "Owner only" with a Sign in button.
2. Signed in with the admin email, `/ops` shows the four tiles and the health list. Another email sees "for the site owner only".
3. Sign up with a new email (or write a test row on `/db-test`), reload: the user count / event feed moves, today's bar grows.
4. Health is green when backups ran in the last 36 h and no webhook or email failed in 7 days.

## Troubleshooting

| What you see | Fix |
|---|---|
| "Add OPS_ADMIN_EMAILS…" | The variable is missing or empty on the host (runtime variable, not build) |
| "This page is for the site owner only" | The signed-in email isn't in `OPS_ADMIN_EMAILS` (comma-separated, case doesn't matter) |
| Revenue stays at $0 after a test payment | Revenue counts only the current mode: a `creem_test_` key shows test payments, a live key shows live ones |
| "Today" seems a day off | Set `OPS_TIMEZONE` to the owner's time zone |
| Backup says "Not set up" | db-backup isn't installed, or its GitHub secrets aren't set so it never ran |
| "Couldn't load the numbers" | Worker → Logs shows `[ops] load failed:` with the database error |

## Using it in code

```ts
import { loadOps, lastDays } from "@/modules/ops/metrics"; // read-only numbers, safe to reuse (e.g. a daily email report)
import { opsAccess } from "@/modules/ops/access";          // gate any owner-only page the same way
```
