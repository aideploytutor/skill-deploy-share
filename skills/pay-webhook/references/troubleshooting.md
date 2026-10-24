# pay-webhook troubleshooting

| What you see | Why | Fix |
|---|---|---|
| Refund in Creem but `/members` still Unlocked | `refund.created` isn't sent to this endpoint | Creem → Developers → Webhooks → endpoint → enable refund.created (or all events), then **Resend** the refund event |
| Partial refund didn't lock access | By design: only a full refund revokes | Refund the full amount, or handle `pay.refunded` with `full: false` yourself |
| Webhook delivery shows 500 | Processing failed (database down, deploy in progress) | Nothing to do: Creem retries. The error is in `pay_webhook_events.error` and the host's logs |
| Webhook response `"result":"ignored"` | The payment isn't from this site (another site on the same Creem store), or an event type we don't handle yet | Expected |
| Webhook response `"result":"duplicate"` | Creem (or you) sent the same event again | Expected: it was handled the first time |
| Payment catch-up fails with 404 | Wrong address in `.github/workflows/pay-reconcile.yml`, or not deployed yet | Fix `SITE_URL` in the workflow, push |
| Payment catch-up 503 "payments not configured" | `CREEM_API_KEY` missing on the site | Add it in the host's settings |
| Catch-up answers `"skipped"` | It ran less than 5 minutes ago | Expected: it's rate-limited so nobody can hammer Creem through it |
| Catch-up stops in a public repo after 60 days | GitHub disables schedules in public repos without commits | Actions → Payment catch-up → Enable workflow |
| Buyer paid, `/pricing` still "Not completed" an hour later | Creem hasn't confirmed it (still processing or abandoned) | Check the checkout in Creem; the catch-up keeps asking for 7 days |
