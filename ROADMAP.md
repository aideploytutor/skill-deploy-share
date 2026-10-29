# Roadmap: 100 skills

**Production-grade on a shoestring.** One skill per episode, each tested live on real accounts before it ships. ✅ means it's in this repo; the rest are planned. Every skill follows the shared conventions in [STACK.md](STACK.md).


## Foundation: set up once, shared by every system

| # | Skill | What it does | Requires |
|---|---|---|---|
| 001 | ✅ [github-vercel-deploy](skills/github-vercel-deploy/) | Deploy a project in one sentence | — |
| 002 | ✅ [app-foundation](skills/app-foundation/) | Set up your product foundation | — |
| 003 | ✅ [db-connect](skills/db-connect/) | A free database that never gets paused | app-foundation |
| 004 | ✅ [domain-setup](skills/domain-setup/) | Use your own domain | github-vercel-deploy |
| 005 | ✅ [email-send](skills/email-send/) | Send email from your site | domain-setup, app-foundation |
| 006 | ✅ [auth-login](skills/auth-login/) | Sign in with Google or an email code | db-connect, email-send |
| 007 | ✅ [env-secrets](skills/env-secrets/) | Keep API keys where they belong | — |
| 008 | ✅ [file-upload](skills/file-upload/) | Let users upload images and files | db-connect, auth-login |
| 009 | ✅ [deploy-cloudflare](skills/deploy-cloudflare/) | Ready to charge? Move to hosting that allows commercial use | app-foundation |
| 011 | ✅ [db-backup](skills/db-backup/) | Back up the database every day | db-connect |

## Payments: the checkout every system shares

| # | Skill | What it does | Requires |
|---|---|---|---|
| 010 | ✅ [pay-checkout](skills/pay-checkout/) | Accept payments in one sentence (Creem, test mode first) | auth-login, deploy-cloudflare |
| 012 | ✅ [pay-webhook](skills/pay-webhook/) | Handle successful payments automatically, never miss one | pay-checkout |
| 013 | ✅ [pay-subscription](skills/pay-subscription/) | Monthly subscriptions | pay-webhook |
| 014 | ✅ [launch-kit](skills/launch-kit/) | From zero to taking money in one sentence: everything above, on Cloudflare, with a checklist and a live check | — |

Payment ideas that were planned for 015–020 (China payments, coupons, receipts, refunds, pricing page, revenue report) move after the warehouse series.

## After launch: see who uses it and what breaks (episodes 015–021)

All on the demo site [shop.labpencil.com](https://shop.labpencil.com). Free tiers only, nothing that needs a credit card.

| # | Skill | What it does | Requires |
|---|---|---|---|
| 015 | ✅ [ops-dashboard](skills/ops-dashboard/) | One owner-only page: new users, revenue, payments, emails, health checks, from your own database | db-connect, auth-login |
| 016 | `uptime-alert` | Know the site is down before your users do (UptimeRobot free, 5-minute checks) | — |
| 017 | `error-alert` | Errors collected and emailed to you, before anyone complains | app-foundation |
| 018 | `analytics-kit` | Who visits and from where (PostHog free, privacy-friendly) | app-foundation |
| 019 | `funnel-kit` | Where visitors drop off between landing and paying | analytics-kit |
| 020 | `session-replay` | Watch what confused users actually did | analytics-kit |
| 021 | `daily-report` | One email every morning with yesterday's numbers | ops-dashboard, email-send |

## Case study: a website and client portal for a US warehouse (episodes 022–036)

One demo site, [warehouse.labpencil.com](https://warehouse.labpencil.com), gets one feature per episode. Made-up brand, example prices.

| # | Skill | What it does | Requires |
|---|---|---|---|
| 022 | ✅ [warehouse-site](skills/warehouse-site/) | Homepage, live quote calculator, inquiries by email + owner list | app-foundation, db-connect, email-send, auth-login |
| 023 | `warehouse-seo` | Found on Google: search listing, business profile, share cards, where inquiries come from | warehouse-site |
| 024 | `warehouse-accounts` | Sellers apply online, the owner approves, each seller sees only their own data | warehouse-site |
| 025 | `warehouse-inbound` | Inbound notices (ASN), carton labels, receiving | warehouse-accounts |
| 026 | `warehouse-orders` | Sellers create dropship orders online | warehouse-accounts |
| 027 | `warehouse-import` | Bulk-import orders from a spreadsheet | warehouse-orders |
| 028 | `warehouse-inventory` | Live inventory, low-stock alerts | warehouse-inbound |
| 029 | `warehouse-tracking` | Tracking numbers emailed to sellers | warehouse-orders |
| 030 | `warehouse-fees` | Every fee recorded automatically from the rate card | warehouse-orders |
| 031 | `warehouse-invoices` | Monthly invoices with line items | warehouse-fees |
| 032 | `pay-stripe-invoice` | Sellers pay invoices online (Stripe card / ACH) | warehouse-invoices |
| 033 | `warehouse-dunning` | Overdue reminders, pause shipping past a limit | pay-stripe-invoice |
| 034 | `warehouse-channels` | Shopify / TikTok Shop orders flow in | warehouse-orders |
| 035 | `warehouse-dashboard` | Owner dashboard on the phone | warehouse-fees |
| 036 | — | What a warehouse system costs to build | — |

## Systems: selling

| # | Skill | What it does | Requires |
|---|---|---|---|
| 021 | `orders-core` | An order system in one sentence | app-foundation, auth-login |
| 022 | `orders-admin` | Order admin: search, update status, export | orders-core |
| 023 | `orders-notify` | Tell customers when their order status changes | orders-core |
| 024 | `shop-core` | An online shop in one sentence | app-foundation, pay-webhook |
| 025 | `shop-admin` | Product management | shop-core |
| 026 | `shop-rules` | Shipping and out-of-stock rules | shop-core |
| 027 | `digital-core` | Sell ebooks, templates and assets | app-foundation, pay-webhook |
| 028 | `digital-secure` | Download links that can't be shared around | digital-core |
| 029 | `digital-license` | License and activation keys | digital-core |
| 030 | `courses-core` | A course platform in one sentence | app-foundation, pay-webhook |
| 031 | `courses-sales` | Course sales and free previews | courses-core |
| 032 | `courses-certificates` | Certificates and assignments | courses-core |

## Systems: keeping users

| # | Skill | What it does | Requires |
|---|---|---|---|
| 033 | `membership-core` | A membership system in one sentence | app-foundation, pay-webhook |
| 034 | `membership-tiers` | Membership tiers and perks | membership-core |
| 035 | `membership-retention` | Renewal reminders and win-backs | membership-core |
| 036 | `rewards-core` | A points system in one sentence | app-foundation, auth-login |
| 037 | `rewards-coupons` | Issue and redeem coupons | rewards-core |
| 038 | `rewards-tasks` | Daily check-ins and task rewards | rewards-core |
| 039 | `referral-core` | A referral program in one sentence | app-foundation, auth-login |
| 040 | `referral-payout` | Referral rewards and payouts | referral-core |
| 041 | `referral-antifraud` | Stop fake referrals | referral-core |
| 042 | `notifications-core` | In-app notifications in one sentence | app-foundation, auth-login |
| 043 | `notifications-channels` | One message, many channels | notifications-core |
| 044 | `notifications-preferences` | Let users choose what they receive | notifications-core |

## Systems: bookings and events

| # | Skill | What it does | Requires |
|---|---|---|---|
| 045 | `booking-core` | A booking system in one sentence | app-foundation, auth-login |
| 046 | `booking-deposit` | Take a deposit when booking | booking-core |
| 047 | `booking-reminders` | Reminders and rescheduling | booking-core |
| 048 | `events-core` | Event sign-ups in one sentence | app-foundation, auth-login |
| 049 | `events-tickets` | Paid tickets and QR check-in | events-core |
| 050 | `events-waitlist` | Waitlists | events-core |

## Systems: users and content

| # | Skill | What it does | Requires |
|---|---|---|---|
| 051 | `reviews-core` | Add reviews in one sentence | app-foundation, auth-login |
| 052 | `reviews-moderation` | Review moderation and spam protection | reviews-core |
| 053 | `reviews-showcase` | Show off good reviews and photos | reviews-core |
| 054 | `forms-core` | A forms system in one sentence | app-foundation, auth-login |
| 055 | `forms-results` | Form results, stats and export | forms-core |
| 056 | `forms-automation` | Act on form submissions automatically | forms-core |
| 057 | `cms-core` | A blog in one sentence | app-foundation, auth-login |
| 058 | `cms-paywall` | Paid posts and subscriber-only reading | cms-core |
| 059 | `cms-newsletter` | Email newsletter | cms-core |
| 060 | `helpdesk-core` | Support tickets in one sentence | app-foundation, auth-login |
| 061 | `helpdesk-faq` | A self-service help center | helpdesk-core |
| 062 | `helpdesk-sla` | Reminders for overdue tickets | helpdesk-core |
| 063 | `ai-support-core` | Add an AI support agent in one sentence | app-foundation, auth-login |
| 064 | `ai-support-handoff` | Hand off to a human when the AI can't answer | ai-support-core |
| 065 | `ai-support-limits` | Control AI usage and cost | ai-support-core |

## Systems: running the business

| # | Skill | What it does | Requires |
|---|---|---|---|
| 066 | `admin-core` | An admin panel in one sentence | app-foundation, auth-login |
| 067 | `admin-roles` | Admin permissions: who can see and change what | admin-core |
| 068 | `admin-audit` | Admin activity log | admin-core |
| 069 | `dashboard-core` | A business dashboard in one sentence | app-foundation, auth-login |
| 070 | `dashboard-weekly` | An automatic weekly report | dashboard-core |
| 071 | `dashboard-alerts` | Alerts when a metric looks wrong | dashboard-core |
| 072 | `crm-core` | Customer management in one sentence | app-foundation, auth-login |
| 073 | `crm-segments` | Customer segments and tags | crm-core |
| 074 | `crm-campaigns` | Email a group of customers | crm-core |
| 075 | `inventory-core` | Inventory in one sentence | app-foundation, auth-login |
| 076 | `inventory-alerts` | Low-stock reminders | inventory-core |
| 077 | `inventory-audit` | Stock counts and adjustment history | inventory-core |
| 078 | `teams-core` | Let teams use your product | app-foundation, auth-login |
| 079 | `teams-roles` | Team member permissions | teams-core |
| 080 | `teams-billing` | Charge per seat | teams-core |

## Operations: stay up, don't break

| # | Skill | What it does | Requires |
|---|---|---|---|
| 083 | `security-check` | A security check-up before launch | — |
| 084 | `rate-limit` | Stop abuse: limit request rates | app-foundation |
| 085 | `cost-guard` | A spending cap for every service | — |
| 086 | `legal-docs` | Privacy policy and terms of service | — |
| 087 | `seo-kit` | Get found on Google | app-foundation |
| 088 | `share-cards` | Link previews with an image and title | app-foundation |
| 089 | `i18n-kit` | Multiple languages, sell worldwide | app-foundation |

## Growth: won't go stale, can scale

| # | Skill | What it does | Requires |
|---|---|---|---|
| 091 | `speed-check` | Site too slow? One-click check-up | — |
| 092 | `load-test` | What happens at 100× traffic | — |
| 093 | `db-migrate-provider` | Move to another database provider in one sentence | db-connect |
| 094 | `restore-drill` | Can you restore your backups? Practice once | db-backup |
| 095 | `upgrade-check` | When to move to a paid plan | — |
| 096 | `status-page` | A public status page | uptime-alert |
| 097 | `postmortem` | A one-page write-up after an incident | — |
| 098 | `skill-template` | Turn something you do often into a skill | — |
| 099 | `stack-upgrade` | Upgrade the foundation without starting over | app-foundation |
| 100 | `starter-kit` | The whole set: a complete online business in one sentence | — |
