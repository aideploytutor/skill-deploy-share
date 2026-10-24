---
name: pay-webhook
description: Make Creem payments on an app-foundation site fully automatic and complete — every paid order unlocks access (pay_grants), refunds and chargebacks take it away, each notification is processed exactly once, failures return 500 so Creem retries, and an hourly catch-up asks Creem about anything still pending. Use when the user says "handle payments automatically", "unlock content after payment", "what if a webhook is missed", "handle refunds", "paid users only page", or a later skill (subscriptions, receipts, orders) requires pay-webhook.
license: MIT
metadata:
  version: "1.0.0"
  episode: "012"
  requires: "pay-checkout"
  provides: "pay_webhook_events, pay_grants tables; src/lib/pay-webhook.ts (handleCreemEvent, grantFor, hasAccess, ensureGrants, listGrants, reconcile); /api/pay/webhook (payments, refunds, disputes), /api/pay/reconcile, /members; .github/workflows/pay-reconcile.yml; pay.granted, pay.refunded, pay.disputed, pay.reconciled events"
---

# pay-webhook

Goal: the owner never touches an order. Pay → access unlocks by itself; refund or chargeback → access goes away by itself; a notification that never arrives is caught within the hour. Follow `../../STACK.md`.

## Why (say this to the owner)

- Creem retries a failed notification only a few times over several hours, then stops (https://docs.creem.io/code/webhooks). A site that's down or mid-deploy at the wrong moment loses the order: money in, nothing delivered.
- The same notification can arrive twice. Without a record, a buyer gets two of everything.
- pay-checkout (010) records payments only. Refunds and chargebacks were ignored, so a refunded buyer kept access.

## What it does

- **Exactly once:** every notification is written to `pay_webhook_events` by Creem's event id first. A repeat answers 200 `duplicate` and does nothing. A failure is saved with the error and answers 500, so Creem retries; the retry is processed again.
- **Unlocks:** `checkout.completed` → payment paid → a `pay_grants` row → `pay.granted`. `hasAccess(userId, productId?)` gates any page; `/members` is a ready example.
- **Takes back:** `refund.created` (full) → payment `refunded`, grant revoked, `pay.refunded`. A partial refund only emits `pay.refunded` with `full: false`. `dispute.created` → `disputed`, revoked, `pay.disputed`.
- **Ignores other sites' events:** a notification whose payment isn't in this site's `pay_payments` is marked `ignored` (one Creem store can serve several sites).
- **Catch-up:** `POST /api/pay/reconcile` asks Creem about this mode's pending payments from the last 7 days (older than 2 minutes, 25 at most) and grants any paid payment that has no grant. It needs no secret, it's safe to call by anyone, and it runs at most once every 5 minutes. A GitHub Actions workflow calls it every hour.
- **Belt and braces:** `/members` calls `ensureGrants()` so a buyer who arrives before the webhook still sees Unlocked.

## Rules

- No new secrets or packages. Never read or type `CREEM_*` values.
- Refunds are the owner's action in Creem. The agent may click Refund on a **test-mode** payment only with the owner's OK, never in live mode.
- Never mark anything paid from the browser's word: payments come from a verified webhook or from Creem's API.

## Steps

### 1. Add the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --url "https://<site>" --json
```

Adds the two tables, `src/lib/pay-webhook.ts`, replaces pay-checkout's `/api/pay/webhook` (only if unedited), adds `/api/pay/reconcile`, `/members`, `.github/workflows/pay-reconcile.yml` (hourly, calls `--url`), patches `/pricing` (shows Refunded/Disputed) and `/pay/success` (Open members area), `stack.json`, a git save point, and the migration if `node_modules` exists (else `npm run db:generate -- --name pay_webhook`). Push; the migration runs in the build.

### 2. Owner: tick the events (a phone works)

Creem → **Developers → Webhooks** → the `/api/pay/webhook` endpoint → make sure **refund.created** and **dispute.created** are sent (or all events). Same secret, nothing to change in the host.

### 3. Verify

1. Signed in, `/members` → Locked (or Unlocked if this account already paid: `ensureGrants` backfills).
2. Owner buys on `/pricing` with the test card → **Open members area** → Unlocked.
3. Creem → Developers → Webhooks → the delivery → **Resend** → the response says `"result":"duplicate"`, nothing doubles.
4. Owner refunds that test payment in Creem → `/members` Locked ("Access was removed after a refund"), `/pricing` ↩️ Refunded, `core_events` has `pay.refunded`.
5. GitHub → **Actions → Payment catch-up → Run workflow** → green; summary `{"ok":true,"checked":…,"recovered":…,"repaired":…}`.

## Using it in code

```ts
import { hasAccess } from "@/lib/pay-webhook";
if (!(await hasAccess(user.id, process.env.CREEM_PRODUCT_ID))) redirect("/pricing");
```

Other systems listen in `core_events` for `pay.granted`, `pay.refunded` (`full`, `amount`, `reason`) and `pay.disputed`.

## Troubleshooting

See `references/troubleshooting.md`.
