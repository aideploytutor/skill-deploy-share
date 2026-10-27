---
name: warehouse-site
description: Give a US warehouse (3PL / 海外仓 / fulfillment center) its own website that brings in sellers — a branded homepage (services, proof numbers, steps, rate card, client-portal preview, location), a live quote calculator sellers use any time of day, an inquiry form that stores every lead and emails the owner and the seller, and an owner-only inquiry list (new → contacted → won/lost). Chinese and English. Use when the user says "website for my warehouse", "3PL website", "海外仓官网", "让卖家在线报价", "收询盘", or a later warehouse skill requires warehouse-site.
license: MIT
metadata:
  version: "1.0.0"
  episode: "015"
  requires: "app-foundation, db-connect, email-send, auth-login (launch-kit installs all of them)"
  provides: "warehouse_inquiries table; src/modules/warehouse/{config,quote,inquiries,ui}; / (warehouse homepage), /quote, /contact, /admin/inquiries; warehouse.inquiry_received and warehouse.inquiry_status_changed events"
---

# warehouse-site

Goal: a small warehouse looks like a big one, and no seller inquiry is lost. Sellers estimate their monthly cost themselves on `/quote`, send it with one click, and the owner gets an email plus a row in `/admin/inquiries`. Follow `../../STACK.md`.

## What the owner edits

Everything lives in **`src/modules/warehouse/config.ts`**: name, badge and headline, proof numbers, services, steps, location, WeChat, hours, and the **rate card** (`rates`). The quote calculator uses exactly those rates, and the server recalculates every quote it receives, so a seller can't send a fake price. Numbers in the shipped config are examples: replace them before going live (the footer says so until then).

Quote math (per month): receiving = units received × `receivingPerUnit`; storage = units stored × (L×W×H ÷ 1728 cu ft) × `storagePerCubicFootMonth`; pick & pack = orders × (`pickFirstItem` + `pickExtraItem` × (items − 1)); oversize (any unit > `oversizeWeightLb` lb or longest side > `oversizeLongestIn` in) adds `oversizePerOrder` per order; `minimumMonthly` tops up. Postage is excluded (billed at label cost).

## Rules

- Copy and prices come from the owner. Never invent proof numbers or prices for a real warehouse: keep the bracketed placeholders until the owner gives real ones.
- `WAREHOUSE_ADMIN_EMAILS` (plain text, comma-separated) decides who can open `/admin/inquiries`; `WAREHOUSE_INBOX_EMAIL` (optional) is where new inquiries go, defaulting to the first admin. Neither is a secret; set them with the owner's OK.
- Payments for warehouse fees are **not** Creem (digital goods only). Later episodes use the warehouse's own Stripe account.
- Never impersonate a real warehouse in demos: use a made-up brand and label numbers as examples.

## Steps

### 1. Add the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

Adds the files above, replaces the homepage only if it's still the app-foundation placeholder, exports the schema, adds the two variables to `.env.example`, records the install, commits, and generates the migration when `node_modules` exists (else `npm run db:generate -- --name warehouse`).

### 2. Owner: variables (a phone works)

Cloudflare → Worker → Settings → Variables and Secrets: `WAREHOUSE_ADMIN_EMAILS` = the owner's email (Text). Email (`RESEND_API_KEY`, `EMAIL_FROM`), sign-in (`BETTER_AUTH_SECRET`) and the database come from the earlier skills. The **build** variable `DATABASE_URL` must point at this site's own database (see Troubleshooting).

### 3. Verify

1. `/` shows the warehouse homepage; `?lang=en` switches to English.
2. `/quote`: changing size or volume updates the estimate; **Send this quote to us** opens `/contact` with the estimate attached.
3. Send a test inquiry (`delivered@resend.dev` is Resend's test inbox) → "收到了" → the owner gets "New inquiry: …" with the quote, and Resend shows the seller's confirmation as Delivered.
4. `/admin/inquiries` (sign in with the admin email): the inquiry is there; status buttons move it to Contacted / Won / Lost.

## Troubleshooting

| What you see | Fix |
|---|---|
| Build fails at `[db-migrate] Failed query: CREATE TABLE "auth_accounts"` | `DATABASE_URL` points at another site's database (in Neon's Connect dialog the Database dropdown remembers the last one). Copy the string with this site's database selected, update both the runtime and the build variable, rebuild. Nothing was changed: the migration runs in a transaction |
| `/contact` says "Database not connected yet" | Add `DATABASE_URL` (Secret) to the runtime variables |
| Inquiry saved but no email | `RESEND_API_KEY` / `EMAIL_FROM` missing, or `WAREHOUSE_ADMIN_EMAILS` empty. Worker → Logs shows `[warehouse] owner email failed` |
| `/admin/inquiries` says "for the warehouse owner only" | The signed-in email isn't in `WAREHOUSE_ADMIN_EMAILS` (comma-separated, case doesn't matter) |
| Cloudflare import says "Repository not found" | GitHub → Settings → Applications → Cloudflare Workers and Pages → Configure → add the repo |

## Using it in code

```ts
import { estimate } from "@/modules/warehouse/quote";      // same math as the page
import { listInquiries, setInquiryStatus } from "@/modules/warehouse/inquiries";
// Other systems can react to "warehouse.inquiry_received" in core_events (payload: platforms, monthlyOrders, quoteTotal).
```
