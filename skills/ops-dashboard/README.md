# ops-dashboard

Your site is live. Did anyone sign up today? Did money come in? Is anything broken? This skill adds one page, `/ops`, that answers all three on your phone.

Live demo (public for the demo, numbers only): https://shop.labpencil.com/ops

## What you get

- **4 tiles with 14-day bars**: new users, revenue, payments, emails sent
- **Health checks**: database, last nightly backup, payment notifications, email delivery (green = nothing to do)
- **What happened**: the most common events this week and the latest ones

It reads the database your site already has. No tracking code, no new account, nothing to pay, works with ad blockers. Only you can open it.

## Use it

Tell your AI:

> Use ops-dashboard to add a dashboard to my site

Then set one variable on your host (a phone works): `OPS_ADMIN_EMAILS` = the email you sign in with. Optional `OPS_TIMEZONE`, e.g. `America/Los_Angeles`.

Needs app-foundation, db-connect and auth-login (launch-kit installs them). Payments, email, uploads and backups show up automatically if you have them.
