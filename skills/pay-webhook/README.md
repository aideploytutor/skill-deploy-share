# pay-webhook

Payments that look after themselves. Someone pays: their access unlocks. They get a refund: it locks again. A payment notification gets lost: it's found within the hour. You never touch an order.

## Why you need it

Creem tells your site about each payment. If your site happens to be down or mid-deploy, Creem retries a few times and then gives up, and the buyer paid for nothing. The same notification can also arrive twice. And with pay-checkout alone, a refunded buyer keeps access.

## What you get

- **Exactly once:** each notification is recorded; a repeat is ignored, a failure is retried
- **Unlock on payment:** a `/members` page only buyers can open, and `hasAccess()` to lock any page
- **Lock on refund or chargeback:** automatic, and `/pricing` shows "Refunded"
- **Hourly catch-up:** GitHub Actions asks your site to double-check pending payments with Creem
- No new keys, no new packages; works on Vercel and Cloudflare Workers

## Before you start

- `pay-checkout` installed (episode 010), the project on GitHub

## Use it

Tell your AI:

> Handle my payments automatically with the pay-webhook skill

Then in Creem (a phone works): **Developers → Webhooks →** your `/api/pay/webhook` endpoint → make sure **refund.created** and **dispute.created** are on.

Try it: buy with the test card → **Open members area** → 🔓 Unlocked. Refund that test payment in Creem → 🔒 Locked.

Costs nothing: the hourly check runs on GitHub Actions (free for public repos; private repos use about 720 of the 2,000 free minutes a month). More in [references/troubleshooting.md](references/troubleshooting.md).
