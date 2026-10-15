---
name: auth-login
description: Add user sign-in to an app-foundation site — "Sign in with Google" plus a 6-digit code by email — with Better Auth, users stored in the site's own Postgres (auth_* tables), no per-user fees. Use when the user says "加登录", "用户登录", "Google 登录", "邮箱验证码登录", "add login / sign in", or a later skill (orders, membership, admin) requires auth-login.
license: MIT
metadata:
  version: "1.0.0"
  episode: "006"
  requires: "app-foundation, db-connect; email-send for email codes; domain-setup recommended"
  provides: "auth_users/auth_sessions/auth_accounts/auth_verifications/auth_rate_limits tables; /login, /account, /privacy, /api/auth/*; getAuth(), getCurrentUser(); auth.user_created event"
---

# auth-login

Goal: visitors can sign in with Google, or with a code emailed to them (no passwords to forget or leak). Users live in the project's own database, so later systems (orders, membership…) reference `auth_users.id`. Follow `../../STACK.md`: **this skill owns the user tables; no other skill creates its own.**

The owner may not be a programmer:
- Agreeing to Google's terms, and copying the Google **Client secret** and `BETTER_AUTH_SECRET` into Vercel, are **the owner's actions**. Never ask for these in the chat, never type them yourself.
- Creating the Google Cloud project and filling in non-secret forms needs the owner's OK first.

## Why Better Auth, and why not WeChat (yet)

- Open source (MIT), runs inside the site, users in your own Postgres, **no monthly-active-user pricing**. Works on Vercel and Cloudflare.
- Google sign-in with only email/name/avatar (openid, email, profile) needs **no Google verification**. The "Push to production?" dialog says verification is needed only with a logo, more than 10 domains, or sensitive/restricted scopes.
- WeChat website login needs, per WeChat Open Platform docs: a developer account on 微信开放平台, the developer qualification certification (开发者资质认证), a **reviewed** website app (网站应用), and a separately reviewed WeChat-login permission; the callback domain must match the one approved. Better Auth has a WeChat provider, so it can be added later without changing the user tables. Don't quote fees or eligibility unless checked on the official site that day.

## Steps

### 1. Prepare the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

It adds:
- `src/db/schema/auth.ts`, `src/lib/auth.ts` (`getAuth()`, `getCurrentUser()`), `src/lib/auth-client.ts`
- `/api/auth/[...all]`, `/login`, `/account`, `/privacy` (a template the owner should read)
- the `better-auth` dependency, an `.env.example` block, `stack.json` → `installed`, and a git save point

It also runs `drizzle-kit generate --name auth_login` when `node_modules` exists. If `manual` says so, run `npm install && npm run db:generate -- --name auth_login` and commit `drizzle/`. Push. The next build creates the tables (db-connect runs migrations before every build).

### 2. Secret for sessions (owner)

Open `https://<domain>/login`. While it isn't configured, it lists what's missing and has a **生成一个** button that makes a random `BETTER_AUTH_SECRET` in the owner's own browser. The owner pastes it into Vercel → Settings → Environment Variables (**Sensitive**).

### 3. Google Cloud (you click with the owner's OK; owner does terms and secrets)

1. console.cloud.google.com → **New Project** (e.g. `my-shop-login`). Free, no card.
2. **Google Auth Platform → Get started**: App name = site name; support email; Audience **External**; contact email. The **User Data Policy** checkbox is the owner's click.
3. **Clients → Create client → Web application** → Authorized redirect URI: `https://<domain>/api/auth/callback/google` (exact, https).
4. The "OAuth client created" dialog shows the Client ID and Client secret. **The owner** copies them into Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Sensitive). Don't read them out.
5. **Branding**: Application home page `https://<domain>`, privacy policy `https://<domain>/privacy`; the authorized domain is the registrable domain (e.g. `example.com`). Don't upload a logo (that triggers verification). Save.
6. **Audience → Publish app → Confirm** → status **In production**, so any Google account can sign in.

### 4. Deploy and test

Redeploy (Vercel uses new variables only on a new deployment). Then:
- `/login` → **用 Google 登录** → lands on `/account` with name, email and avatar.
- Sign out → `/login` → email → **发送验证码** → the code arrives (Resend, `tag: login-code`) → enter it → `/account`.
- Same email both ways = same user (account linking).
- Asking for codes too fast shows "操作太频繁" (3 codes/min per visitor; codes expire in 5 min; 3 wrong tries invalidate a code). Each code is one email, and Resend free allows 100/day.

## Using it in code

```ts
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
const user = await getCurrentUser(await headers()); // null when signed out
if (!user) redirect("/login?next=/orders");
```

New users emit `auth.user_created` (subjectId = user id) into `core_events`. Other systems react to it; they never write `auth_*` tables.

## Tell the user (short)

"Your site now has sign-in: Google, or a 6-digit email code. Users are stored in your own database, free at any number of users." Mention `/account` and that `/privacy` is a template to read.
