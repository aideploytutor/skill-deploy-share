# pay-subscription troubleshooting

| What you see | Why | Fix |
|---|---|---|
| `/billing` says to set `CREEM_SUBSCRIPTION_PRODUCT_ID` | Not set in this deployment | Add it (plain text); on Vercel redeploy |
| Log `Creem 404` on `/billing` | The product ID is from the other mode (test vs live) or mistyped | Copy it again from the same mode as `CREEM_API_KEY` |
| Paid, but `/billing` still shows Subscribe | The webhook hasn't linked the subscription yet, or subscription events aren't sent | Refresh after a few seconds; check Creem → Webhooks sends `checkout.completed` and `subscription.*` |
| Subscriber got a lifetime unlock in `/members` | pay-webhook older than 1.1.0 granted the first payment | Upgrade pay-webhook (its apply.mjs), then delete that row from `pay_grants` |
| Second month shows "duplicate" in Creem's delivery log | pay-webhook older than 1.1.0 keyed events by subscription id only | Upgrade pay-webhook to 1.1.0 |
| Manage or cancel does nothing | No Creem customer id stored yet | It's filled by the first webhook; refresh `/billing` |
| Subscriber locked out right after the renewal date | Renewal webhook missed and the 3-day grace passed | Opening `/billing` asks Creem and fixes it; check webhook deliveries |
| Cancelled but still has access | By design: access lasts to the end of the period already paid | Expected |
