# Going live: taking real money

Do these with the owner, one at a time. Each one is the owner's decision.

1. **Creem store verification.** Creem → Home → follow "Switch to live": business details, identity check, the website review (they look at the site, pricing, a support email that matches the domain, terms/privacy). Creem only allows digital products and software: https://docs.creem.io/faq/prohibited-products
2. **Payout account.** Creem → Balance / Payouts: bank account (mainland China and Hong Kong banks are supported).
3. **Live products.** Switch the dashboard to live, recreate the one-time and monthly products, copy the new `prod_…` IDs.
4. **Live webhook.** Live mode → Developers → Webhooks → `https://<domain>/api/pay/webhook`, all events.
5. **Swap the variables** in Worker → Settings → Variables and Secrets: `CREEM_API_KEY` (live key, no `creem_test_`), `CREEM_WEBHOOK_SECRET` (live webhook), `CREEM_PRODUCT_ID`, `CREEM_SUBSCRIPTION_PRODUCT_ID`. The TEST MODE badge disappears.
6. **A real $1 purchase** with your own card, then refund it in Creem: `/members` unlocks, then locks.
7. **Pages buyers expect:** `/privacy` (comes with auth-login), terms of service and refund policy (write them; Creem's review asks), a support email on your domain.
8. **Backups you can restore.** Run the db-backup restore drill once (Actions → Database restore into an empty database).
9. **Watch the free limits** (STACK.md): Workers Free 100k requests/day; if Worker → Metrics shows "Exceeded CPU Time Limits" or error 1102, move to Workers Paid ($5/month).
