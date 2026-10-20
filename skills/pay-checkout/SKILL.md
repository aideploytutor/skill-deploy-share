---
name: pay-checkout
description: Add a working "Buy" button to an app-foundation site with Creem (merchant of record, handles worldwide sales tax, pays out to banks in 80+ countries including mainland China), test mode first, payments recorded in Postgres via a signed webhook. Use when the user says "let my site take payments", "add a pay button", "start charging", "accept money", or a later skill (orders, membership, courses) requires pay-checkout.
license: MIT
metadata:
  version: "1.0.0"
  episode: "010"
  requires: "app-foundation, db-connect, auth-login; deploy-cloudflare (or Vercel Pro) before real money"
  provides: "pay_payments table; src/lib/pay.ts (startCheckout, confirmCheckout, markPaid, verifyWebhook, listPayments); /pricing, /pay/success, /api/pay/webhook; pay.paid event"
---

# pay-checkout

Goal: a signed-in visitor presses **Buy now**, pays on Creem's checkout page, comes back to "Payment received", and the payment is in `pay_payments` with a `pay.paid` event. Test mode first. Follow `../../STACK.md`.

## Why Creem

- **Merchant of record:** Creem sells to the buyer and remits VAT/sales tax worldwide; the owner doesn't register for tax in every country.
- **Payouts:** local bank transfer in its supported countries, which include mainland China and Hong Kong (https://docs.creem.io/merchant-of-record/supported-countries). Stripe doesn't open accounts for mainland China residents; owners with a US/HK company can use Stripe instead (episode 014).
- **No SDK needed:** `src/lib/pay.ts` uses fetch + Web Crypto, so it runs on Vercel and Cloudflare Workers.
- Don't quote Creem's fees from memory; check https://www.creem.io/pricing that day.

## Rules

- **Vercel Hobby forbids commercial use** ("any method of requesting or processing payment"). Test mode is fine anywhere; before live keys, the site must run on Cloudflare (deploy-cloudflare) or Vercel Pro. Say so.
- Creem signup, store details, identity verification (KYC) and payout bank details are the owner's. Never fill them in.
- `CREEM_API_KEY` and `CREEM_WEBHOOK_SECRET` are pasted by the owner into the host, marked secret. Never read, copy or type them. The product ID is not a secret.
- The agent never types a card number, not even the test card: the owner pays the test checkout.
- A payment counts only when Creem says so: the success page asks Creem's API, and the webhook is verified with `creem-signature` (HMAC-SHA256 of the raw body). Never mark paid from query parameters.

## Steps

### 1. Add the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

Adds `src/db/schema/pay.ts` (`pay_payments`), `src/lib/pay.ts`, `/pricing` (product card, Buy button, "My payments"), `/pay/success`, `/api/pay/webhook`, the `.env.example` block, `stack.json` → `installed`, a git save point, and the migration if `node_modules` exists (else run `npm run db:generate -- --name pay_checkout`). Push.

### 2. Owner: Creem in test mode

Everything works from a phone browser:
1. https://www.creem.io → Sign up → create a store.
2. Turn **Test Mode** on.
3. **Products → Create product**: one-time, any price → copy the `prod_...` ID (send it to the agent; not secret).
4. **Developers → API key** (test, starts `creem_test_`) → paste into the host as **secret** `CREEM_API_KEY`.
5. **Developers → Webhooks** → add `https://<domain>/api/pay/webhook` → paste its signing secret as **secret** `CREEM_WEBHOOK_SECRET`.

Agent sets `CREEM_PRODUCT_ID` (plain text) with the owner's OK. Cloudflare redeploys on save; on Vercel, redeploy.

### 3. Verify

- `/pricing` shows the product name and price with a **TEST MODE** badge; signed out it says "Sign in to buy".
- Owner presses **Buy now** → Creem checkout → test card `4242 4242 4242 4242`, any future date, any CVC → back on `/pay/success` with "Payment received".
- `/pricing` → "My payments" shows ✅ Paid with the amount; `core_events` has `pay.paid`.
- Webhook: Creem → Developers → Webhooks shows a 200 delivery. A request with a wrong signature gets 401.

### 4. Going live (owner, when ready)

Complete Creem's store verification and payout details, switch the product and keys to live mode, update `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET` (live webhook) and `CREEM_PRODUCT_ID`, and make sure production isn't on Vercel Hobby.

## Using it in code

```ts
import { startCheckout } from "@/lib/pay";
const url = await startCheckout({ id: user.id, email: user.email }, "prod_...");
redirect(url);
```

Systems that sell things (orders, membership, courses) listen for `pay.paid` in `core_events`; its payload has `userId`, `productId`, `amount`, `currency`, `mode`.

## Troubleshooting

See `references/troubleshooting.md`.
