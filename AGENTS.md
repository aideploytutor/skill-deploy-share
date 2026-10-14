# Agent instructions

This repository holds portable agent skills. Each skill lives in `skills/<name>/` and contains:
- `SKILL.md`: when to use the skill and the steps to follow
- `README.md`: human-facing usage notes
- `scripts/`: helper scripts
- `references/`: deeper docs

## Using a skill
When a user request matches a skill's `description`:
1. Read that skill's `SKILL.md`.
2. Follow it.
3. Run the scripts it mentions, with paths resolved relative to the skill folder.

## Skills in this repo

| Skill | Use when |
|---|---|
| [github-vercel-deploy](skills/github-vercel-deploy/SKILL.md) | The user wants a local project pushed to a new GitHub repo and deployed on Vercel with auto-deploy on push. Example phrasings: "部署到 GitHub 和 Vercel", "ship this to Vercel". |
| [app-foundation](skills/app-foundation/SKILL.md) | The user wants to start a new website/app/shop/SaaS from scratch, or another skill requires `app-foundation`. Example phrasings: "搭一个产品底座", "新建一个项目". |
| [db-connect](skills/db-connect/SKILL.md) | The user wants the site to save data / connect a database, or another skill requires `db-connect`. Example phrasings: "连上数据库", "让网站能存东西". |

## Shared conventions
Every skill must follow `STACK.md` (shared stack, table prefixes, env var names, requires/provides metadata). The full plan is in `ROADMAP.md`.

## Adding a skill
1. Copy `templates/SKILL.template.md` to `skills/<new-name>/SKILL.md`.
2. Fill in the frontmatter (`name` must equal the folder name; `description` says when to use it).
3. Add a human-facing `skills/<new-name>/README.md`.
4. Add a row to the table above and to the root README.md.
5. Keep scripts cross-platform. Prefer Node (`.mjs`) or Python over `.sh`/`.ps1`.
