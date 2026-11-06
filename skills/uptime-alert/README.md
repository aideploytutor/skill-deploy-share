# uptime-alert

If your site goes down at 3 a.m., you want to hear it from your phone, not from an angry customer. This skill sets up a free outside check every 5 minutes that alerts you by email and phone push, plus a public status page.

Demo: https://shop.labpencil.com (Uptime card) · health check: https://shop.labpencil.com/api/health

## What you get

- **A real health check**: `/api/health` says `"status":"up"` only when the site *and* the database work
- **UptimeRobot monitor** (free: 50 monitors, every 5 minutes): email + push from the UptimeRobot app
- **Status page** on stats.uptimerobot.com you can share with customers
- **Alert test switch**: one variable fakes an outage, so you know the alert really reaches you
- **Uptime on /ops**: 30-day uptime and the last outage (with ops-dashboard)

## Use it

Tell your AI:

> Use uptime-alert to tell me on my phone when my site goes down

Then, on your phone: sign up at uptimerobot.com, add one Keyword monitor (your AI gives you the exact URL and keyword), install the UptimeRobot app. Optional: a read-only API key as a secret on your host so `/ops` shows uptime. Never paste keys into a chat.
