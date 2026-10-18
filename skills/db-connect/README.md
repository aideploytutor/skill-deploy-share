# db-connect (episode 003)

Connect a free database so your site can actually save things. It isn't shut down when nobody visits, and moving to another provider later is a one-line config change.

## Tell your AI

> Use db-connect to connect a free database to my project

The AI updates the code first, walks you through a few clicks in the Vercel dashboard to create the database, then deploys and checks it.

## Why Neon

| | Neon (default) | Supabase |
|---|---|---|
| Free plan when idle | Sleeps after 5 minutes, wakes on the next visit | **Project is paused after 7 days without activity** |
| Free storage | 1 GB per project | 500 MB |
| How to create it | Right in the Vercel dashboard, no separate sign-up | Separate sign-up |

Both are standard Postgres, so you can move any time. Free tiers change; check the official pages. Our verification log is in [STACK.md](../../STACK.md).

## What you do yourself

- In Vercel → Storage, click **Create Database → Neon → Free** and accept the terms (this also creates your Neon account)
- You never copy the database password into a chat; Vercel adds it to the project for you

## What you get

- Tables are created and updated before every deploy (`scripts/db-migrate.mjs`). If that fails, the deploy stops and the broken version never goes live
- `/api/health` and `/status` show the database connection and response time
- A `/db-test` page: click to save a row, refresh, and it's still there. It keeps at most 20 rows, so nobody can flood it

## Run it as a command-line tool

```bash
node scripts/apply.mjs --dir ./my-shop --check   # show which files would change
node scripts/apply.mjs --dir ./my-shop           # apply (safe to run twice)
```

If you've edited `/api/health` or `/status`, the script won't overwrite them and tells you to merge by hand.
