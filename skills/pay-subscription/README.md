# pay-subscription

Get paid every month, automatically. A visitor subscribes once, Creem charges their card each month, and your site keeps their access in step: renewed → still in, cancelled → in until the end of what they paid, card failed → 3 days' grace while Creem retries.

## What you get

- `/billing`: your plan ("$9 / month"), **Subscribe**, and for subscribers "✅ Active · renews on Nov 24" plus **Manage or cancel** (Creem's own portal: cancel, change card)
- `/members` opens for subscribers as well as one-time buyers
- `hasActiveSubscription()` to put any page behind the subscription
- Renewals counted and recorded as `pay.renewed` events, ready for revenue reports
- No new keys, no new packages; works on Vercel and Cloudflare Workers

## Before you start

- `pay-webhook` 1.1.0 or newer (episode 012)
- Creem sells digital products and software only, not physical goods

## Use it

Tell your AI:

> Let my site charge a monthly subscription with the pay-subscription skill

Then in Creem (Test Mode, a phone works): **Products → New product → Subscription** → monthly, any price → copy the `prod_...` ID and set it as `CREEM_SUBSCRIPTION_PRODUCT_ID`.

Try it: `/billing` → Subscribe → test card `4111 1111 1111 1111` → ✅ Active · renews on … → Manage or cancel → cancel → you keep access until the period ends.

More in [references/troubleshooting.md](references/troubleshooting.md).
