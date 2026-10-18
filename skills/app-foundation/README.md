# app-foundation (episode 002)

Set up your product foundation in one sentence: the web framework, the database layer and the project rules, all at once. Every later skill (database, sign-in, payments, orders, shop…) installs on top of it.

## Tell your AI

> Use app-foundation to create a new project called "My Shop"

The AI checks your computer, creates the project, installs dependencies and opens it in your browser.

## What you get

- A site that runs locally and deploys as-is (Next.js + TypeScript + Tailwind)
- A ready-made database layer (Drizzle + standard Postgres). It works as soon as episode 003 connects a database, and switching providers later needs no code changes
- `core_events`, the table systems use to notify each other: orders, membership and rewards all connect through it
- `/api/health` health check and a `/status` page
- `stack.json`, which records installed skills so later skills can check their dependencies
- The project's own `AGENTS.md`, so any AI that opens the project follows the same rules

## Prerequisites

- Node.js 20.9 or newer (download the LTS from https://nodejs.org)
- git (only needed to deploy)

## Run it as a command-line tool

```bash
node scripts/create.mjs --dir ./my-shop --name "My Shop"
node scripts/create.mjs --dir ./my-shop --check     # is this a foundation project?
node scripts/create.mjs --help
```

| Exit code | Meaning |
|---|---|
| 0 | Success |
| 3 | Node/npm missing or too old |
| 4 | npm install failed |
| 10 | Target folder isn't empty |

## What's inside

```
src/
  app/             pages (page.tsx home, status/, api/health/)
  db/              database: index.ts client, schema/ tables
  lib/events.ts    events between systems
  modules/         each system's business logic goes here
stack.json         installed skills
AGENTS.md          project rules for AI
```
