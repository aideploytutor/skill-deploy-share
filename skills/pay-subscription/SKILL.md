---
name: pay-subscription
description: Add monthly (or yearly) subscriptions to an app-foundation site with Creem — subscribe once, the card is charged every period automatically, access follows the subscription (renewal extends it, cancel keeps it to the end of what was paid, failed renewal gets 3 days' grace), with a /billing page and Creem's self-service portal to cancel. Use when the user says "charge monthly", "subscriptions", "recurring payments", "membership fee", "每个月收钱", or a later skill requires pay-subscription.
license: MIT
metadata:
  version: "1.0.0"
  episode: "013"
  requires: "pay-webhook 1.1.0+ (and through it pay-checkout, auth-login, db-connect)"
  provides: "pay_subscriptions table; src/lib/pay-subscription.ts (handleSubscriptionEvent, hasActiveSubscription, accessUntil, syncSubscription, portalLink, listSubscriptions); /billing; /members opens for subscribers; pay.subscribed, pay.renewed, pay.subscription_canceling, pay.subscription_ended events"
---

# pay-subscription

Goal: a visitor subscribes once on `/billing`, Creem charges their card every month, and the site keeps access in step with what they've paid — no cron jobs, no manual work. Follow `../../STACK.md`.

## How access works

| Creem says | Status | Access |
|---|---|---|
| checkout completed / `subscription.paid` | active | until current period end + 3 days |
| `subscription.past_due` (renewal failed, Creem retrying) | past_due | same, so a card hiccup doesn't lock anyone out |
| `subscription.scheduled_cancel` or `subscription.canceled` | scheduled_cancel / canceled | until the end of the period already paid |
| `subscription.unpaid`, `paused`, `expired` (ended), a refund of a subscription payment | ended | none |

In testing, `subscription.paid` arrived **before** `checkout.completed`, so the handler also links a subscription from the `userId` our checkout puts in metadata. Creem's portal cancel sends `subscription.canceled` and keeps access to the period end, which matches the table.

Renewals (`subscription.paid` with a later period end) add to `renewals` and emit `pay.renewed` with the amount, for revenue reports. If a renewal webhook never arrives, `/billing` asks Creem (`GET /subscriptions?subscription_id=`) when the period end has passed.

## Rules

- Recurring products never get a lifetime grant (pay-webhook 1.1.0 `grantFor` skips them); subscription access lives in `pay_subscriptions`.
- Cancelling happens in **Creem's customer portal** (`POST /customers/billing` → `customer_portal_link`), opened from `/billing` → Manage or cancel. The site never stores card details.
- Product creation, KYC and live mode are the owner's. `CREEM_SUBSCRIPTION_PRODUCT_ID` is not a secret; set it with the owner's OK. Never type card numbers.
- Creem only sells digital goods and software (no physical goods): https://docs.creem.io/faq/prohibited-products

## Steps

### 1. Add the code

```bash
node <pay-webhook-dir>/scripts/apply.mjs --dir "<project>" --url "https://<site>"   # upgrades pay-webhook to 1.1.0 if needed
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

Adds `pay_subscriptions`, `src/lib/pay-subscription.ts`, `/billing`, plugs `handleSubscriptionEvent` into `/api/pay/webhook`, lets subscribers into `/members` (+ "Or subscribe monthly" link), `.env.example`, `stack.json`, a git save point, and the migration if `node_modules` exists (else `npm run db:generate -- --name pay_subscription`). Push.

### 2. Owner: a monthly product (a phone works)

Creem (Test Mode on) → **Products → New product → Subscription** template → name, price, **Monthly** → Create → copy the `prod_...` ID. Set `CREEM_SUBSCRIPTION_PRODUCT_ID` in the host (plain text). The existing webhook already sends subscription events if it has "all events".

### 3. Verify

1. `/billing` shows the plan with "/ month" and **Subscribe**.
2. Owner subscribes with the test card `4111 1111 1111 1111` → `/pay/success` → `/billing` shows **✅ Active · renews automatically on <date>**; `/members` Unlocked; `core_events` has `pay.subscribed`.
3. Creem → Subscriptions shows it active with the next payment date.
4. `/billing` → **Manage or cancel** → Creem portal → Cancel → `/billing` shows **Canceled · you keep access until <date>**.

## Using it in code

```ts
import { hasActiveSubscription } from "@/lib/pay-subscription";
if (!(await hasActiveSubscription(user.id, process.env.CREEM_SUBSCRIPTION_PRODUCT_ID))) redirect("/billing");
```

## Troubleshooting

See `references/troubleshooting.md`.
