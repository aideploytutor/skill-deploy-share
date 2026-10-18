# env-secrets (episode 007)

An API key is your ID card at a service: whoever has it can act as you, sending email from your domain or spending your credit. This skill keeps keys where they belong, and tells you what to do if one leaks.

## Tell your AI

> Use env-secrets to check my project for leaked keys

## What it does

- **Scan**: checks every file and every past commit for keys written into code (Resend, Stripe, OpenAI, Google, GitHub, database passwords…)
- **Block**: a commit that contains a key is stopped automatically
- **Safety net**: `.env` files never get pushed to GitHub

Run it any time: `npm run secrets:scan`

## A key already leaked?

**Deleting the message or the file doesn't help. Revoke the old key at the provider and create a new one.** Paste the new key straight into Vercel's environment variables with Sensitive turned on.

How to replace keys for each provider: [references/rotate.md](references/rotate.md).

## Where keys go

| ✗ Never | ✓ Here |
|---|---|
| A chat (with an AI or anyone) | Vercel → Settings → Environment Variables |
| Your code | `.env.local` on your own computer (never uploaded) |
| GitHub | |
