# launch-kit

From an empty folder to a site that takes money. One sentence to your AI builds everything (sign-in, email from your domain, a Buy button, monthly subscriptions, automatic refunds, daily backups) on **Cloudflare** (free plan, commercial use allowed), then gives you a checklist written for your project and checks the live site for you.

## What you get

- A complete project: episodes 002–013 installed in the right order, one database migration, a private GitHub repo
- `LAUNCH.md`: your checklist with your site's names and links (accounts, domain, database, Worker, email, payments, backups)
- `launch.mjs status`: what's done, what's left
- `launch.mjs doctor`: checks the live site (domain, HTTPS, database, sign-in, email records, payments, webhook) and tells you how to fix each ❌

## You need

Free accounts: GitHub, Cloudflare, Neon, Resend, Creem. A domain (Cloudflare sells them at cost). About an hour, most of it waiting for DNS.

## Use it

Tell your AI:

> Use launch-kit to build my site "My Shop" at shop.example.com, from scratch to taking payments

Then follow `LAUNCH.md` together; every account step works from a phone browser. Finally:

```bash
node launch.mjs doctor --url https://shop.example.com
```

Never paste keys into a chat, including with your AI: they go into Cloudflare and GitHub settings only.

Going live with real money: [references/go-live.md](references/go-live.md). Moving a domain you bought elsewhere: [references/cloudflare-domain.md](references/cloudflare-domain.md).
