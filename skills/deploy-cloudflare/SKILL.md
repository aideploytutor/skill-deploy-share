---
name: deploy-cloudflare
description: Move an app-foundation (Next.js) site from Vercel Hobby to Cloudflare Workers, whose free plan doesn't forbid commercial use, so the site can take payments. Sets up OpenNext, GitHub auto-deploys, Hyperdrive for fast database connections, and fixes the Workers-only bugs. Use when the user says "I want to charge money", "Vercel free plan doesn't allow commercial use", "deploy to Cloudflare", "move off Vercel", or before pay-checkout on a Hobby project.
license: MIT
metadata:
  version: "1.0.0"
  episode: "009"
  requires: "app-foundation"
  provides: "wrangler.jsonc, open-next.config.ts, cf:* scripts, Workers-safe database and auth clients, optional Hyperdrive binding"
---

# deploy-cloudflare

Goal: the same code runs on Cloudflare Workers (and keeps working on Vercel), deployed automatically from GitHub on every push. Follow `../../STACK.md`.

## Why

- Vercel Hobby is "restricted to non-commercial personal use only"; "any method of requesting or processing payment" counts as commercial (https://vercel.com/docs/limits/fair-use-guidelines). Charging on Vercel means Pro ($20/month per member).
- Cloudflare Workers Free has no such restriction: 100,000 requests a day, then errors until midnight UTC (never a bill). Workers Paid is $5/month.
- **CPU, honestly:** Free is documented as 10 ms CPU per request. Our Next.js demo used ~66 ms median (P90 ~330 ms) and Cloudflare cut 0 requests in testing. That's not guaranteed: if visitors start seeing error 1102 / "Exceeded CPU", move to Workers Paid ($5). Say this to the owner; don't promise "free forever".

## Rules

- Creating the Cloudflare account, the GitHub authorization and any verification are the owner's clicks. Never sign in or tick a CAPTCHA for them.
- Secrets (`DATABASE_URL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `GOOGLE_CLIENT_SECRET`, the Hyperdrive connection string) are pasted by the owner, from where they were created, straight into Cloudflare. Never read, copy or type them. Values marked Sensitive in Vercel can't be read back: create new ones (Resend key, BETTER_AUTH_SECRET via /login, Google client secret).
- Recommend the **Secret** type for secrets. If the owner keeps them as plain text, never copy them into `wrangler.jsonc` even though Cloudflare's banner suggests it: that file is committed.
- Non-secret values (site URL, site name, email sender) the agent may type, with the owner's OK.

## Steps

### 1. Patch the project

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

It adds `wrangler.jsonc` (with `keep_vars: true` so dashboard variables survive deploys), `open-next.config.ts`, `public/_headers`, the `@opennextjs/cloudflare` + `wrangler` packages and `cf:*` scripts, and `.open-next/` to `.gitignore`. It also fixes the three things that break on Workers:

| Problem on Workers | Symptom | Fix applied |
|---|---|---|
| Next.js bundles the Node build of `postgres` | `CONNECT_TIMEOUT` to the database | `serverExternalPackages: ["postgres"]` in `next.config` |
| One database client reused across requests | 2nd request fails | `src/db/index.ts` creates a client per request on Workers (one shared pool elsewhere) |
| One Better Auth instance (holding a DB client) reused | "Failed to get session", server error after login | `getAuth()` per request on Workers |

`result.variables` lists every variable name from `.env.example` and whether it's a secret. Push.

### 2. Owner: create the Worker from GitHub

Cloudflare → Workers & Pages → Create → **Connect GitHub** (owner authorizes; suggest "Only select repositories") → pick the repo →
- Project name: `result.worker` (must match `name` in `wrangler.jsonc`)
- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Preview builds: off (optional)
→ Deploy. The site appears at `https://<worker>.<account>.workers.dev`. The first build works without variables.

### 3. Variables

Worker → Settings → **Variables and Secrets** → Add variable. Agent types the plain ones (`NEXT_PUBLIC_SITE_URL` = the workers.dev or custom URL, `NEXT_PUBLIC_SITE_NAME`, `EMAIL_FROM`); the owner pastes the secrets. Each save redeploys.

Google sign-in: add `https://<new-domain>/api/auth/callback/google` to the OAuth client's redirect URIs and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### 4. Hyperdrive (strongly recommended, free)

Without it every request opens a new TCP+TLS connection to the database (~550 ms per query in our test). With it: ~70 ms.

Owner: Storage & databases → **Hyperdrive** → Connect database → public database → paste the **direct (unpooled)** connection string (`DATABASE_URL_UNPOOLED` for Neon) → turn **caching off** (cached reads could keep a signed-out session alive for up to 60 s) → Create. The config ID is not a secret:

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --hyperdrive <32-char-id>
```

This adds the binding (with a placeholder `localConnectionString`, which `opennextjs-cloudflare deploy` requires). Push.

### 5. Verify

- `/api/health` → `"database":{"status":"connected"}`, several times in a row (latency < 150 ms with Hyperdrive)
- `/status` → runtime "Cloudflare"
- `/db-test` → save a row, reload, still there
- `/login` → email code arrives, `/account` works, reload `/account` twice
- `/files` (if file-upload ≥ 1.0.1) → upload and delete
- Worker → Metrics → "Exceeded CPU Time Limits" stays 0

### 6. Go live (when ready to charge)

Add the custom domain under Worker → Domains (the domain's DNS must be on Cloudflare), update `NEXT_PUBLIC_SITE_URL` and the Google redirect URI, then disconnect the project from Vercel so production runs only on Cloudflare. Ask before each of these.

## Troubleshooting

See `references/troubleshooting.md`.
