---
name: db-connect
description: Connect a free Postgres database (Neon, created from the Vercel dashboard) to an app-foundation project so the site can save data; tables are created automatically on every deploy. Use when the user says "连上数据库", "让网站能存东西", "connect a database", or another skill requires db-connect.
license: MIT
metadata:
  version: "1.0.0"
  episode: "003"
  requires: "app-foundation"
  provides: "scripts/db-migrate.mjs (runs before every build), DB check in /api/health and /status, /db-test page, drizzle/ migrations"
---

# db-connect

Goal: the project gets a real Postgres database. The database is free, doesn't get paused when idle, and is standard Postgres, so it can move to another provider later. Every deploy creates or updates the tables before the site goes live. Follow `../../STACK.md`.

The user is probably not a programmer:
- **Never** ask them to paste the database URL or password into the chat.
- Never type it into a form yourself. The Vercel integration sets it for them.

## Why Neon via Vercel

| | Neon (default) | Supabase |
|---|---|---|
| Free plan when idle | auto-suspends after 5 min, wakes on the next request | **project paused after 7 days without activity** |
| Free storage | 1 GB per project | 500 MB |

Both are standard Postgres. Moving between them changes `DATABASE_URL` only. Creating Neon from the Vercel dashboard needs no separate sign-up, and Vercel injects the connection variables into the project automatically.

## Steps

### 1. Check the project

```bash
node <skills>/app-foundation/scripts/create.mjs --check --dir "<project>"
```

If it exits 3, the project isn't an app-foundation project. Offer to install app-foundation (episode 002) first.

### 2. Prepare the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

It's safe to run twice. It adds:
- `scripts/db-migrate.mjs`, and makes `npm run build` run it first
- a database check in `/api/health` and `/status`
- a `/db-test` page
- the first migration (the `core_events` table), if the project has none yet

It also records `db-connect` in `stack.json` and makes a git save point.

If `manual` in the output isn't empty, the owner had changed one of those files. Merge the change by hand, keeping their edits.

### 3. Create the database (the owner clicks; you guide)

The project must already be on Vercel (episode 001). Open the project in Vercel, in the browser tool if you have one, then walk the owner through:

1. **Storage** tab → **Create Database** → choose **Neon** → **Continue**.
2. Accept the terms. This creates their Neon account, so **it must be the owner's click**.
3. Choose the **Free** plan, a region close to their users, and a name.
4. **Connect to project**: tick **Development, Preview, Production** → Connect.

Afterwards, the project's **Settings → Environment Variables** list should include `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. You may confirm the *names* exist; never read or show the values.

### 4. Deploy

Push the commit from step 2 with `git push`, or click **Redeploy** in Vercel if it was already pushed. Environment variables only apply to new deployments. The build log should show:

```
[db-migrate] Database is up to date (… ms).
```

If it shows `Failed`, the build stops on purpose. The usual causes are the database not being connected to that environment, or a typo in a migration. Show the error line to the owner in plain words.

### 5. Verify

- Open `https://<project>.vercel.app/api/health` and check that `database.status` is `"connected"`.
- Open `/db-test`, press **存一条测试数据**, reload, and confirm the row is still there.
- Open `/status` and check that it says 已连接 with a latency in ms.

### 6. Local development (optional)

To make `npm run dev` use the same database:
1. In Vercel → Storage → the database → **.env.local** tab → Copy.
2. The owner pastes it into the project's `.env.local` file themselves. It is git-ignored.

Don't ask them to paste it into the chat.

## Tell the owner (short)

"Your site now has a free database. Anything the site saves stays saved, even after redeploys. Tables are created automatically every time you deploy." Then suggest the next step: **auth-login**, episode 004, which adds email and Google sign-in.

## For skills that add tables later

1. Add `src/db/schema/<system>.ts` and export it from `src/db/schema/index.ts`.
2. Run `npm run db:generate` and commit the new files in `drizzle/`.
3. The next deploy applies them.

Never edit the production database by hand.
