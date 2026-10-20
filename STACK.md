# Shared stack and conventions (every skill must follow these)

The goal of this repo: **one skill per episode, each one installs a mature system in one sentence**, at the lowest possible cost, on a stack that won't go stale and can scale later. So that 100 skills can stack on top of each other and any provider can be swapped out, every skill shares the stack and conventions below.

## 1. Three principles

1. **Leave the mature parts to mature services.** Payments, email, sign-in and storage come from existing services or open-source libraries. The AI only writes the glue code and the screens.
2. **Depend only on open standards.** Standard Postgres for the database, the S3 API for files, OAuth for sign-in, webhooks between systems. Any provider can be replaced as a whole without rewriting code.
3. **Start on free tiers; scaling up is a plan upgrade.** The same code runs on free and paid plans. Upgrading changes configuration only.

## 2. Default stack

| Part | Default | Can be replaced with | Why |
|---|---|---|---|
| Web framework | Next.js (TypeScript) | — | Best AI code-generation quality, biggest community |
| Database | Postgres on Neon | Supabase / any Postgres | The free plan sleeps when idle but is never paused |
| Database access | Drizzle ORM | — | Close to plain SQL, unaffected by a provider change |
| Sign-in | Better Auth | any OAuth solution | Users live in your own database, no monthly-active-user cap |
| File storage | Vercel Blob | Cloudflare R2 / any S3 API | No card needed to start; all storage code sits in one file, so it can move to R2 (10 GB free) |
| Payments | Creem (merchant of record) | Stripe / Lemon Squeezy / Paddle | No monthly fee; handles sales tax worldwide; pays out to mainland China banks, which Stripe doesn't |
| Email | Resend | any SMTP service | Free tier is enough to start |
| Hosting (not charging yet) | Vercel Hobby | Cloudflare | Easiest deploys |
| Hosting (charging) | Cloudflare Workers (+ Hyperdrive) | Vercel Pro | Vercel's free plan is non-commercial only; Workers Free isn't restricted, Paid is $5/month |

## 3. Verified free tiers (2026-10-12)

Re-check the official pages and update this table before each new skill ships.

| Service | Free tier | Watch out for | Source |
|---|---|---|---|
| Vercel Hobby | 100 GB bandwidth and 1M function invocations a month | **Non-commercial use only**: payments, ads and client work all count as commercial | [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines) |
| Cloudflare Workers | 100k requests a day, 10 ms CPU per request (documented), 64 MiB worker | Our Next.js demo used ~66 ms CPU per request and wasn't cut off, but that isn't guaranteed; Paid is $5/month. Commercial use isn't restricted (re-checked 2026-10-19) | [Limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Cloudflare Hyperdrive | 100k database queries a day on Workers Free | Turn query caching off for apps with sign-in | [Pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/) |
| Neon | 1 GB storage and 100 CU-hours per project, up to 100 projects | Sleeps after 5 minutes idle, wakes on the next request | [Pricing](https://neon.com/pricing) |
| Supabase | 500 MB database, 50k MAU, 1 GB storage, up to 2 projects | **Projects are paused after 7 days without activity** | [Pricing](https://supabase.com/pricing) |
| Resend | 3,000 emails a month, max 100 a day, 3 domains | Paid from $20/month; without a verified domain you can only email yourself (re-checked 2026-10-14) | [Pricing](https://resend.com/pricing) |
| Vercel Blob (Hobby) | 1 GB storage, 10 GB downloads, 2,000 uploads a month | Over the limit it pauses for the rest of 30 days, never charges (checked 2026-10-18) | [Pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) |
| Cloudflare R2 | 10 GB storage, 1M writes and 10M reads a month, free downloads | A payment method is required to enable R2 | [Pricing](https://developers.cloudflare.com/r2/pricing/) |
| Stripe | No monthly fee | US cards: 2.9% + 30¢ per charge; international cards +1.5% | [Pricing](https://stripe.com/pricing) |

## 4. Conventions every skill follows

- **Declare dependencies and outputs.** In SKILL.md `metadata`, list `requires` (skills that must be installed first) and `provides` (what the skill adds). If a dependency is missing, offer to install it first.
- **Prefix tables.** Every table a skill creates starts with its system name, such as `orders_` or `shop_`, so skills never clash. User tables are created once by `auth-login` (episode 006); other skills reference them and never create their own.
- **Database changes are reversible.** Every schema change goes through a Drizzle migration. Never edit a database by hand.
- **Secrets live in environment variables only.** Names are uppercase with a system prefix, such as `STRIPE_SECRET_KEY`. No key is ever hard-coded, and the owner is never asked to paste one into a chat.
- **Systems talk through events.** When something happens in one system (an order is paid), it calls `emitEvent()` to write to the `core_events` table that `app-foundation` creates. Other systems read events and react; they never write another system's tables.
- **Record installed skills.** After installing, add `"<skill>": "<version>"` to `stack.json` → `installed`. Later skills check dependencies there.
- **Deployable to both hosts.** The same code must deploy to Vercel and to Cloudflare.
- **Account actions belong to the owner.** Sign-ups, sign-ins, authorizations and payment onboarding are done by the owner; the skill guides them step by step.
- **Ship only after a live test.** Every skill is run from scratch on real accounts before it's published. Screenshots and docs come from that run.
