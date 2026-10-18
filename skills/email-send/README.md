# email-send (episode 005)

Let your site send email from **your own domain**: login codes, receipts, notifications, and keep it out of spam. Uses Resend; the free tier is 3,000 emails a month, at most 100 a day.

## Tell your AI

> Use email-send so my site can send email

## What you'll do (the AI walks you through it)

1. Sign up for Resend ("Log in with Google" is quickest)
2. Add a sending subdomain in Resend, such as `mail.yourdomain.com`
3. Once you OK the plan, add 3 DNS records at your registrar (plus 1 recommended DMARC record)
4. Create an API key in Resend and paste it into Vercel's environment variables **yourself**. Don't send it to anyone, including the AI
5. Open `yoursite/email-test` and send a test email to any address

To send from the test page to an address other than your own, add a test passphrase `EMAIL_TEST_CODE` in Vercel (make one up, keep it to yourself). Without it, the test page can only email you, so nobody can use your domain to send spam.

## Why your own domain is required

Without a verified domain, Resend only lets you email your own address. To send login codes to users, you need a domain (episode 004) and to verify it.

## Why send from a subdomain like mail.yourdomain.com

Resend recommends it: your sending reputation stays separate from your main domain, and any mailbox on the main domain is unaffected.

## Common problems

| Symptom | Cause |
|---|---|
| The checker reports `doubled-host` | Namecheap and GoDaddy add your domain to the Host field automatically. Enter only `resend._domainkey.mail`, not the full name |
| Resend stays Pending | DNS hasn't propagated yet; usually verified within 15 minutes, up to 72 hours |
| Emails land in spam | Add the DMARC record; don't make it look like an ad; start with low volume |
| The page says it isn't set up | Redeploy after adding environment variables |

## Checker script (read-only, no key needed)

```bash
node scripts/check.mjs --domain mail.example.com --wait 900
```

## Use it in code

```ts
import { sendEmail } from "@/lib/email";
await sendEmail({ to: "user@example.com", subject: "Your code", text: "Your code is 123456" });
```
