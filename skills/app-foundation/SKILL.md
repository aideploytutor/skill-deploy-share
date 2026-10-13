---
name: app-foundation
description: Create a new web product foundation (Next.js + TypeScript + Tailwind + Postgres via Drizzle) that every other skill in skill-deploy-share builds on. Use when the user wants to start a new project, website, app, shop or SaaS from scratch, says "搭一个产品底座", "新建一个项目", "从零开始做一个网站", or another skill requires app-foundation.
license: MIT
metadata:
  version: "1.0.0"
  episode: "002"
  requires: ""
  provides: "Next.js app, src/db (Drizzle + Postgres client), core_events table, emitEvent(), /api/health, /status, stack.json, project AGENTS.md"
---

# app-foundation

Goal: in one step, the user gets a new project that runs locally, deploys to Vercel or Cloudflare, and is ready for the other skills in this repo (database, login, payments, orders...) to stack on top. Follow `../../STACK.md`.

The user is probably not a programmer. Speak plainly, keep questions to a minimum, and never ask for passwords or secret keys in the chat.

## 1. Ask two things (one message)

- **What's the product called?** Chinese is fine. It's shown on the homepage and in page titles.
- **Where should the folder go?** Default to a new folder named after the product, inside the folder the user is working in.

If the user already answered either one, don't ask it again.

## 2. Check the computer

```bash
node -v    # needs v20.9 or newer
npm -v
git --version
```

- **Node missing or too old:** tell the user to install the LTS version from https://nodejs.org, and say that after installing they need to **open a new terminal / restart the AI tool** so PATH refreshes. Then check again.
- **git missing:** it's fine for now, because it's only needed to deploy. Mention it at the end.

## 3. Create the project

Resolve the script path relative to this SKILL.md:

```bash
node <skill-dir>/scripts/create.mjs --dir "<folder>" --name "<product name>" --json
```

The script:
- copies `template/` into the folder
- fills in the name
- writes `stack.json`
- copies `.env.example` to `.env.local`
- runs `npm install`
- makes the first git save point

It refuses to overwrite a folder that isn't empty (exit 10). In that case, ask for a new folder name. Don't install into an existing project automatically.

| Exit | Meaning | Do |
|---|---|---|
| 0 | created | continue |
| 3 | Node/npm too old or missing | step 2 |
| 4 | `npm install` failed | show the last lines; usually it's the network. Retry once with `npm install` in the folder |
| 10 | folder not empty | ask for another name |
| 64 | bad arguments | fix the command |

## 4. Show it running

```bash
cd "<folder>"
npm run dev
```

Open http://localhost:3000, in the browser tool if you have one, and confirm the homepage shows the product name and the "接下来" checklist. Also check http://localhost:3000/api/health, which returns `"ok": true`.

## 5. Tell the user (short, plain)

- Where the project is, and that it's running at http://localhost:3000.
- What they have: a working website foundation. It isn't connected to a database yet, so nothing is stored, and that's expected.
- What to say next:
  - 「用 github-vercel-deploy 把这个项目部署到 GitHub 和 Vercel」 (episode 001) to put it online.
  - 「用 db-connect 给我的项目连上一个免费数据库」 (episode 003) to save data.

## Deploying it

Use the `github-vercel-deploy` skill (episode 001). Vercel detects Next.js by itself; no settings to change. The **first** deploy can spend several minutes on "Installing dependencies" (no build cache yet) — tell the user that's normal; later deploys are much faster. Check `https://<project>.vercel.app/api/health` afterwards.

## Rules for everything built on this foundation

These rules are also written into the project's own `AGENTS.md`, so any AI that opens the project follows them:

- Tables go in `src/db/schema/<system>.ts`, prefixed with the system name (e.g. `orders_`), and are exported from `src/db/schema/index.ts`.
- Systems talk through `emitEvent()` and the `core_events` table. They never write each other's tables.
- Secrets live only in environment variables, documented in `.env.example`.
- After installing a skill, add it to `stack.json` → `installed`.
- Don't use platform-only APIs, so the project keeps deploying to both Vercel and Cloudflare.

## Check an existing project

```bash
node <skill-dir>/scripts/create.mjs --check --dir "<folder>"
```

Other skills run this before installing; exit 3 means app-foundation isn't installed there.
