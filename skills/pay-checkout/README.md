# pay-checkout

Add a **Buy** button to your site and get paid. Uses **Creem**, a merchant of record: it handles sales tax in every country and pays out to your bank, including banks in mainland China. Start in test mode with a test card; switch to live when you're ready.

## What you get

- `/pricing`: your product, its price, a **Buy now** button, and "My payments"
- `/pay/success`: the page buyers come back to (it checks with Creem before saying "paid")
- `/api/pay/webhook`: Creem tells your site about every payment, signed so nobody can fake one
- A `pay_payments` table and a `pay.paid` event for orders, memberships and courses later

No extra npm packages; works on Vercel and Cloudflare Workers.

## Before you start

- `app-foundation`, `db-connect` and `auth-login` installed
- To take **real** money: not on Vercel Hobby (non-commercial only). Use `deploy-cloudflare` (free) or Vercel Pro. Test mode works anywhere.

## Use it

Tell your AI:

> Add a pay button to my site with the pay-checkout skill, test mode first

Then, on creem.io (a phone works):

1. Sign up, create a store, turn on **Test Mode**
2. **Products → Create product** (one-time), copy its `prod_...` ID
3. **Developers → API key**: paste into your host as secret `CREEM_API_KEY`
4. **Developers → Webhooks**: add `https://your-domain/api/pay/webhook`, paste its secret as `CREEM_WEBHOOK_SECRET`
5. Set `CREEM_PRODUCT_ID`, open `/pricing`, pay with test card `4111 1111 1111 1111`

Never paste these keys into a chat, including with your AI.

More in [references/troubleshooting.md](references/troubleshooting.md). Fees: [creem.io/pricing](https://www.creem.io/pricing).
