# deploy-cloudflare

Ready to charge money? Vercel's free plan is for **non-commercial use only**: a pay button, ads, or selling anything means upgrading to Pro ($20/month). This skill moves your site to **Cloudflare Workers**, whose free plan has no such rule, and keeps it deploying automatically from GitHub.

## What it does

- Adds the Cloudflare build setup (OpenNext + Wrangler); Vercel keeps working from the same code
- Fixes the bugs that only show up on Cloudflare (database timeouts, login breaking after the first request)
- Optional **Hyperdrive** (free) for fast database connections: ~70 ms instead of ~550 ms per query in our test

## Costs, honestly (checked 2026-10-19)

| | Vercel Hobby | Cloudflare Workers Free | Cloudflare Workers Paid |
|---|---|---|---|
| Price | $0 | $0 | $5/month |
| Commercial use | ❌ not allowed | ✅ not restricted | ✅ |
| Limits | 1M function calls/month | 100,000 requests/day | 10M requests/month included |
| CPU per request | — | 10 ms (documented) | up to 5 min |

Our Next.js demo used ~66 ms CPU per request and Cloudflare didn't stop a single one, but the free plan's documented limit is 10 ms. If visitors ever see error 1102, switch to the $5 plan.

Sources: [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/)

## Use it

Tell your AI:

> Move my site to Cloudflare with the deploy-cloudflare skill

Or run it yourself:

```bash
node skills/deploy-cloudflare/scripts/apply.mjs --dir ./my-shop
```

Then, in Cloudflare (you click these):

1. Workers & Pages → Create → **Connect GitHub** → your repo
2. Build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`
3. Settings → **Variables and Secrets**: add the variables the script lists (paste secrets yourself, mark them **Secret**)
4. Optional: Hyperdrive → Connect database → paste the direct database URL, caching **off** → run the script again with `--hyperdrive <id>`

More in [references/troubleshooting.md](references/troubleshooting.md).
