# pay-checkout troubleshooting

| What you see | Why | Fix |
|---|---|---|
| `/pricing` says "Payments aren't connected yet" | `CREEM_API_KEY` or `CREEM_PRODUCT_ID` missing in this deployment | Add them; on Vercel redeploy |
| Server error on `/pricing`; log `Creem 401` | Wrong key, or a test key with a live product (or the reverse) | Test key ↔ product created in Test Mode; live key ↔ live product |
| Log `Creem 404` on the product | Product ID typo, or it belongs to the other mode | Copy the `prod_...` ID again from the same mode |
| Buy redirects to `/login` | Not signed in: every payment belongs to a user | Sign in first |
| Back on the site but "We couldn't find that payment" | `checkout_id` missing or from another mode | Check `CREEM_API_KEY` mode; look up the checkout in Creem |
| "Payment is processing" | Creem hasn't finished yet | Refresh; the webhook also records it |
| Webhook deliveries fail with 401 | `CREEM_WEBHOOK_SECRET` doesn't match that webhook | Copy the secret of the webhook pointing at `/api/pay/webhook` |
| Webhook deliveries fail with 403 / challenge | Bot protection on your domain | Add a rule skipping challenges for `/api/pay/webhook` |
| Paid twice in "My payments"? | Each Buy press starts a checkout; unfinished ones stay "Not completed" | Only rows marked Paid were charged |
