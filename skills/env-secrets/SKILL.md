---
name: env-secrets
description: Keep API keys and passwords out of code, git and chat. Scans the project and its git history for leaked keys, blocks commits that contain one, and walks the owner through replacing a leaked key. Use when the user says "I leaked my API key", "check for leaked keys", "scan for secrets", after anyone pastes a key into a chat, or before making a repo public.
license: MIT
metadata:
  version: "1.0.0"
  episode: "007"
  requires: "a git project (app-foundation recommended)"
  provides: "scripts/secret-scan.mjs, npm run secrets:scan, .githooks/pre-commit (auto-enabled by npm install), .gitignore for .env files, references/rotate.md"
---

# env-secrets

Goal: secret keys only ever live in two places, **Vercel environment variables** (for the live site) and **`.env.local`** (on the owner's computer, never committed). Follow `../../STACK.md`.

The owner may not know what an API key is. Explain it this way: "An API key is your house key for a service. Whoever has it can act as you there: send email from your domain, spend your credit."

## When the owner has just pasted a key into the chat

1. Don't use the key. Don't repeat it back.
2. Say plainly: deleting the message doesn't help. The fix is to **revoke** that key and create a new one.
3. Walk them through `references/rotate.md` for that provider. The new key goes **straight into Vercel** (Sensitive), not into the chat.
4. Then continue the original task.

## Install the guard

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>"
```

It adds:
- `scripts/secret-scan.mjs` and `npm run secrets:scan`
- `.githooks/pre-commit`, turned on by `git config core.hooksPath .githooks`. Every `npm install` re-enables it via `prepare`, so teammates get it too.
- `.env*` in `.gitignore` (keeping `.env.example`)

It also records the install, commits, and runs a full scan including git history. Exit 0 means clean.

What the scanner catches: Resend, Stripe live, OpenAI, Anthropic, GitHub, Google (OAuth secret + API key), AWS, Slack, private keys, database URLs with a password, `*_SECRET/TOKEN/API_KEY = "…"` assignments, committed `.env` files, and a `.gitignore` that doesn't ignore `.env`. Keys are printed masked (`re_DEM••••00`).

## When it finds something

1. **Revoke and replace** the key (see `references/rotate.md`). Removing it from the file is not enough if it was ever committed or shared.
2. Move the value to Vercel → Settings → Environment Variables (Sensitive), or `.env.local` locally.
3. Change the code to `process.env.NAME`.
4. A false positive (an example value)? Add `secret-scan: allow` as a comment on that line.

## Rules for you (the agent)

- Never ask for a key in chat, never type one into a form, never write one into a file other than `.env.local` on the owner's machine.
- When code needs a key, write `process.env.NAME`, add the name (no value) to `.env.example`, and tell the owner where to set it.
- Before making a repo public: `npm run secrets:scan -- --history`.

## Tell the user (short)

"The project is clean. From now on a commit with a key in it is stopped automatically, and `npm run secrets:scan` checks everything any time." If anything leaked, name the provider and the one action: revoke and replace.
