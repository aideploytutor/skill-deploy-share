# Project rules for AI assistants

This project was created with the `app-foundation` skill from
https://github.com/aideploytutor/skill-deploy-share and follows its STACK.md.
The owner may not be a programmer: explain things in plain words, ask before
anything that costs money, publishes, or deletes data, and never ask them to
paste passwords or secret keys into the chat.

## Stack (do not swap without asking)
- Next.js (App Router) + TypeScript + Tailwind CSS
- Postgres through Drizzle ORM (`src/db`). Standard SQL only, so any Postgres provider works.
- Deploys on Cloudflare Workers (deploy-cloudflare). Keep it portable: standard Web APIs, no platform-only features.

## Where things go
| What | Where |
|---|---|
| Tables | `src/db/schema/<system>.ts`, exported from `src/db/schema/index.ts` |
| Table names | prefixed with the system: `orders_items`, `shop_products` |
| System logic | `src/modules/<system>/` |
| Pages | `src/app/<system>/` |
| Secrets | environment variables only, listed in `.env.example` with the skill name; never in code |
| Installed skills | `stack.json` → `installed` (add `"<skill>": "<version>"` after installing one) |

## Database changes
Change the schema files, then `npm run db:generate` and `npm run db:migrate`.
Never edit a production database by hand. Never drop a table or column without asking.

## Events (how systems connect)
When something happens that other systems may care about, call
`emitEvent({ type: "<system>.<event>", source: "<skill>", subjectId, payload })`
from `src/lib/events.ts`. Systems read `core_events`; they never write each other's tables.

## Before saying "done"
Run `npm run typecheck` and `npm run build`, open the changed pages, and tell the
owner in one or two plain sentences what changed and how to see it.
