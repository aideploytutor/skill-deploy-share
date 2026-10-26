---
name: launch-kit
description: Take someone from an empty folder to a live site on Cloudflare that signs users in, sends email from their domain, takes one-time payments and monthly subscriptions (Creem), handles refunds automatically and backs up its database daily — by running every foundation and payment skill in order, then walking the owner through the account steps with a personalized checklist and a live end-to-end check. Cloudflare only, no Vercel. Use when the user says "start from scratch", "build me a site that takes payments", "launch my product", "一句话从 0 到收钱", "set everything up", or asks what's still missing before launch.
license: MIT
metadata:
  version: "1.0.0"
  episode: "014"
  requires: "Node.js 20.9+, git; the owner's free accounts: GitHub, Cloudflare, Neon, Resend, Creem; a domain"
  provides: "a project with app-foundation, db-connect, deploy-cloudflare, email-send, auth-login, env-secrets, pay-checkout, pay-webhook, pay-subscription, db-backup; LAUNCH.md (owner checklist); launch.mjs status / doctor"
---

# launch-kit

Goal: one sentence → a real, Cloudflare-hosted site at the owner's domain that can take money, with every remaining manual step listed and verified. Follow `../../STACK.md`. Hosting is **Cloudflare Workers only**; don't suggest Vercel.

## Rules

- The agent does all the code; the owner does accounts, sign-ins, DNS/nameserver changes, deleting DNS records, and pasting secrets into Cloudflare/GitHub. Never ask for a key in chat, never type one.
- Ask before each owner step that changes something live (nameservers, custom domain, deleting a record), and say what visitors will notice (usually 1–2 minutes of downtime on that hostname).
- File uploads are not part of the kit (the current file-upload skill stores files on Vercel Blob). Add it later if needed.
- Test mode only. Going live (real money) follows `references/go-live.md`, step by step with the owner.

## Steps

### 1. Ask three things (one message)

Product name, the web address (e.g. `shop.example.com`; a domain the owner owns or will buy), and whether the GitHub repo should be private (default) or public.

### 2. Build everything

```bash
node <skill-dir>/scripts/launch.mjs build --dir "<folder>" --name "<Name>" --domain <shop.example.com> --json
```

Runs app-foundation → db-connect → deploy-cloudflare → email-send (`mail.<root>`) → auth-login → env-secrets → pay-checkout → pay-webhook (catch-up pointed at the domain) → pay-subscription → db-backup, then `npm install`, one migration (`npm run db:generate -- --name launch`), `LAUNCH.md`, and the GitHub repo (`gh repo create --private --source . --push` when `gh` is signed in; otherwise the owner creates an empty repo and the agent pushes). Re-running skips finished steps. If a step fails, fix it and run the same command again.

### 3. Walk the owner through LAUNCH.md

`LAUNCH.md` is written for this project (names, URLs, repo). Go section by section, one at a time; most steps work from a phone browser. Order matters:

1. **Domain on Cloudflare** (`references/cloudflare-domain.md`): add the domain, **check the email records before switching nameservers** (Cloudflare's import misses `resend._domainkey.*` — seen in our test), owner changes nameservers at the registrar.
2. **Neon** connection string.
3. **Worker from GitHub** (build/deploy commands in LAUNCH.md), then the **build variable** `DATABASE_URL` (without it the build skips migrations and no tables exist), then the runtime variables table, then **Domains → Add Domain** (delete an existing record for that hostname first if Cloudflare refuses).
4. **Resend**: add `mail.<root>` → Auto configure with Cloudflare → Verified.
5. **Creem** (test mode): one-time product, monthly Subscription product, webhook `https://<domain>/api/pay/webhook` with all events.
6. **GitHub secrets** for backups: `DATABASE_URL`, `DB_BACKUP_PASSPHRASE` → run Database backup once.

`node launch.mjs status --dir "<folder>"` shows what's done in code and which LAUNCH.md boxes are still open.

### 4. Check it end to end

```bash
node <skill-dir>/scripts/launch.mjs doctor --url https://<domain>
```

Checks: domain uses Cloudflare DNS · HTTPS · served by Workers · database connected · /login · DKIM and return-path records · /pricing and /billing configured · webhook rejects a fake notification (401) · payment tables + catch-up (200). Every ❌ prints the fix. Then the owner does one test purchase (card `4111 1111 1111 1111`), checks `/members`, and one test subscription on `/billing`.

### 5. Report

Tell the owner in plain words what works, the address, and the one next step (usually: real products and going live, `references/go-live.md`).

## Troubleshooting

| What you see | Fix |
|---|---|
| Build OK but pages 500 / "relation does not exist" | Build variable `DATABASE_URL` missing → Worker → Settings → Builds → Variables and secrets → add → Retry build |
| "Hostname already has externally managed DNS records" | DNS → Records → delete the old record for that hostname (owner), add the domain again |
| Login codes don't arrive after moving DNS | `node <email-send>/scripts/check.mjs --domain mail.<root>`; usually the DKIM TXT wasn't imported |
| `npm install` fails in build | Fix network/Node version, run `launch.mjs build` again (it resumes) |
| Webhook deliveries fail in Creem | URL must be the custom domain; `CREEM_WEBHOOK_SECRET` must be that webhook's secret |
