---
name: uptime-alert
description: Know the site is down before users do — a free UptimeRobot keyword monitor on /api/health every 5 minutes with email and phone-push alerts, a public status page, an alert test switch (HEALTH_FORCE_DOWN) and 30-day uptime shown on /ops. Use when the user says "tell me when my site goes down", "uptime monitor", "网站挂了提醒我", "在线监控", "status page", or a later skill requires uptime-alert.
license: MIT
metadata:
  version: "1.1.0"
  episode: "016"
  requires: "app-foundation (ops-dashboard optional: shows uptime on /ops)"
  provides: "/api/health keyword + HEAD + no-store + HEALTH_FORCE_DOWN; src/modules/uptime/uptimerobot.ts; UPTIMEROBOT_API_KEY, STATUS_PAGE_URL, UPTIME_MONITOR_MATCH variables"
---

# uptime-alert

Goal: if the site stops answering, the owner's phone buzzes within ~5 minutes, and they can prove it works because they tested it once. Follow `../../STACK.md`.

Why UptimeRobot: free plan has 50 monitors, 5-minute checks, keyword monitors, email alerts, the mobile app's push alerts and one status page; no card needed. The check runs from outside your host, so it notices when Cloudflare, DNS or the database is down — a check inside the site can't.

Why a **keyword** monitor on `/api/health` (not just the homepage): a page can answer 200 with an error message inside. `/api/health` answers `{"status":"up",…}` when the app works; the monitor alerts when `"status":"up"` is missing.

**Never let the 5-minute monitor query the database** (fixed in 1.1.0). A scale-to-zero database (Neon free suspends after 5 idle minutes) pinged every 5 minutes never sleeps, burns ~180 CU-hours a month against a 100 CU-hour quota, and is suspended until next month — this happened to our demo. `/api/health` therefore skips the database; `/api/health?db=1` is the deep check for occasional use. Database outages are still caught: the hourly payment catch-up (pay-webhook) and the nightly backup fail and GitHub emails the owner.

## Rules

- The owner creates the UptimeRobot account, the monitor, the status page and the key. Never ask for their password or key in chat.
- Use a **read-only** API key for `UPTIMEROBOT_API_KEY` (Secret on the host). The main key could delete monitors.
- The free plan's status page lives at `stats.uptimerobot.com/…` (custom domain is paid). It's public: name monitors without private info.
- `HEALTH_FORCE_DOWN=true` is only for the alert test. Remind the owner to delete it the same day; `/ops` and the health JSON say when it is on.

## Steps

### 1. Prepare the site

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

Replaces the foundation's `/api/health` (keeps a customised one and says what to add), adds `src/modules/uptime/uptimerobot.ts`, documents the variables, records the install, commits. Push, then:

```bash
node <skill-dir>/scripts/apply.mjs --verify https://<domain>
```

expects `200 · keyword found · not cached`.

### 2. Owner: UptimeRobot (a phone works, ~5 minutes)

1. uptimerobot.com → Sign up (free). Install the **UptimeRobot** app and sign in: that's the phone push.
2. **+ New monitor** → type **Keyword** → URL `https://<domain>/api/health` → keyword `"status":"up"` → **Alert when keyword does not exist** → interval 5 min → tick their email → Create.
3. **Status pages** → Create → pick the monitor → save. The URL (not a secret) can go in `STATUS_PAGE_URL` and on the site footer.
4. Optional, for `/ops`: **Integrations & API** → **Read-only API key** → create → host → Variables and Secrets → **Secret** `UPTIMEROBOT_API_KEY`.

### 3. Alert test (do it once)

1. Host variable (Text) `HEALTH_FORCE_DOWN` = `true` → save (Cloudflare redeploys by itself).
2. Within ~5 minutes: email "Monitor is DOWN" + phone push; `/ops` shows "DOWN right now".
3. Delete `HEALTH_FORCE_DOWN` → next check sends "Monitor is UP" with the downtime length.
4. `/ops` → Online check shows 30-day uptime and "last down … for N min".

## Troubleshooting

| What you see | Fix |
|---|---|
| Monitor is down but the site opens fine | Keyword typed differently: it must be `"status":"up"` with the double quotes, case-sensitive; or the monitor points at the homepage instead of `/api/health` |
| No phone push | Push comes from the UptimeRobot app: install it, sign in, allow notifications. Email arrives either way |
| `/ops` says "Couldn't read UptimeRobot" | The key is missing/mistyped, or it's a monitor-specific key for another monitor. Worker → Logs shows `[ops] uptime:` |
| `/ops` shows another site's monitor | Set `UPTIME_MONITOR_MATCH` to part of this site's URL |
| `/api/health` 503 with database error | Real outage: check Neon status and `DATABASE_URL`; the monitor did its job |
| Forgot to delete `HEALTH_FORCE_DOWN` | Health JSON shows `"reason":"HEALTH_FORCE_DOWN is on"`; delete the variable |

## Using it in code

```ts
import { getUptime } from "@/modules/uptime/uptimerobot"; // { status, ratio: { d1, d7, d30 }, lastDown, downs30d } or null; cached 60 s (free API: 10 calls/min)
```
