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
| [github-vercel-deploy](skills/github-vercel-deploy/SKILL.md) | The user wants a local project pushed to a new GitHub repo and deployed on Vercel with auto-deploy on push. Example phrasings: "deploy this to GitHub and Vercel", "ship this to Vercel". |
| [app-foundation](skills/app-foundation/SKILL.md) | The user wants to start a new website/app/shop/SaaS from scratch, or another skill requires `app-foundation`. Example phrasings: "start a new project", "set up a foundation for my shop". |
| [db-connect](skills/db-connect/SKILL.md) | The user wants the site to save data / connect a database, or another skill requires `db-connect`. Example phrasings: "connect a database", "make my site save data". |
| [domain-setup](skills/domain-setup/SKILL.md) | The user wants their own domain/subdomain on the site, or `email-send` needs a domain. Example phrasings: "connect my domain", "use my own URL". |
| [email-send](skills/email-send/SKILL.md) | The user wants the site to send email (login codes, receipts) from their own domain, or another skill requires `email-send`. Example phrasings: "let my site send email", "send login codes by email". |
| [auth-login](skills/auth-login/SKILL.md) | The user wants sign-in (Google, email code) on the site, or another skill requires `auth-login`. Example phrasings: "add login", "sign in with Google", "email code sign-in". |
| [env-secrets](skills/env-secrets/SKILL.md) | The user leaked or pasted an API key, wants to check the project for secrets, or is about to make a repo public. Example phrasings: "check for leaked keys", "I pasted my API key, what now?". |
| [file-upload](skills/file-upload/SKILL.md) | The user wants users to upload images/files, uploads vanish or fail after deploying, or another skill requires `file-upload`. Example phrasings: "add file upload", "let users upload photos", "upload works locally but not on Vercel". |
| [deploy-cloudflare](skills/deploy-cloudflare/SKILL.md) | The user wants to charge money / take payments on a Vercel Hobby project, wants to deploy to Cloudflare, or move off Vercel. Example phrasings: "I want to start charging", "deploy to Cloudflare", "Vercel free plan doesn't allow commercial use". |
| [pay-checkout](skills/pay-checkout/SKILL.md) | The user wants the site to take payments / add a buy button, or a later skill requires `pay-checkout`. Example phrasings: "let my site take payments", "add a pay button", "start charging". |
| [db-backup](skills/db-backup/SKILL.md) | The user wants database backups, is worried about losing data, deleted data by mistake, or another skill requires `db-backup`. Example phrasings: "back up my database", "what if I lose my data", "restore my database". |
| [pay-webhook](skills/pay-webhook/SKILL.md) | The user wants payments handled automatically (unlock after paying, refunds, chargebacks), worries about missed webhooks, wants a paid-users-only page, or a later skill requires `pay-webhook`. Example phrasings: "handle payments automatically", "unlock content after payment", "handle refunds". |
| [pay-subscription](skills/pay-subscription/SKILL.md) | The user wants to charge monthly/yearly, recurring payments or a membership fee, or a later skill requires `pay-subscription`. Example phrasings: "charge monthly", "add subscriptions", "membership fee". |
| [launch-kit](skills/launch-kit/SKILL.md) | The user wants to start from scratch and end up with a live site that takes payments, or asks what is still missing before launch. Example phrasings: "build me a site that takes payments", "launch my product from scratch", "what is left before I can launch?". |
| [warehouse-site](skills/warehouse-site/SKILL.md) | The user wants a website for a US warehouse / 3PL / 海外仓 that brings in sellers: quote calculator, inquiries, owner list. Example phrasings: "website for my warehouse", "3PL website", "海外仓官网". |

## Shared conventions
Every skill must follow `STACK.md` (shared stack, table prefixes, env var names, requires/provides metadata). The full plan is in `ROADMAP.md`.

## Adding a skill
1. Copy `templates/SKILL.template.md` to `skills/<new-name>/SKILL.md`.
2. Fill in the frontmatter (`name` must equal the folder name; `description` says when to use it).
3. Add a human-facing `skills/<new-name>/README.md`.
4. Add a row to the table above and to the root README.md.
5. Keep scripts cross-platform. Prefer Node (`.mjs`) or Python over `.sh`/`.ps1`.
