---
name: email-send
description: Let an app-foundation site send email from the owner's own domain (Resend, free tier 3,000/month), with DNS checks so mail doesn't land in spam and a /email-test page. Use when the user says "让网站能发邮件", "发验证码邮件", "send email from my domain", "set up Resend", or a later skill (auth-login, pay-receipts) requires email-send.
license: MIT
metadata:
  version: "1.0.0"
  episode: "005"
  requires: "app-foundation, domain-setup (a domain you own); db-connect recommended"
  provides: "src/lib/email.ts sendEmail(); /email-test; email.sent / email.failed events; stack.json email"
---

# email-send

Goal: the site can email **anyone** (login codes, receipts, notifications) from the owner's own domain, and the mail reaches the inbox. Follow `../../STACK.md`.

The owner may not be a programmer:
- Signing up at Resend, accepting terms, and creating the API key are **the owner's clicks**.
- The API key goes **straight from Resend into Vercel**. Never ask them to paste it into the chat, and never type it yourself.
- Adding DNS records needs their OK, same as domain-setup.

## Why Resend, and why your own domain

- Free: 3,000 emails/month, max 100/day, 3 domains (checked 2026-10-14 at resend.com/pricing; check again before quoting). Paid starts at $20/month.
- Without a verified domain, Resend only lets you send **to your own address**. So a real domain (episode 004) is required before strangers can get a login code.
- The code calls Resend's plain HTTP API (no SDK), so it runs on Vercel and Cloudflare. Changing provider means rewriting only `src/lib/email.ts`.

## Steps

### 1. Choose the sending address

Use a **subdomain**: Resend recommends it, and it keeps the root domain's own mailbox and reputation untouched.

| Site | Sending domain | From |
|---|---|---|
| `shop.example.com` or `example.com` | `mail.example.com` | `我的小店 <hello@mail.example.com>` |

### 2. Prepare the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --sending-domain mail.example.com --json
```

Safe to run twice. Adds `src/lib/email.ts` (`sendEmail()`), the `/email-test` page, an `.env.example` block, `stack.json` → `installed` and `email`, and a git save point. Push it.

### 3. Resend account and domain (owner clicks; you guide)

1. resend.com → sign up. "Log in with Google" is the simplest. The owner accepts the terms.
2. **Domains → Add domain** → the sending domain from step 1. Pick the region nearest the users (default is fine).
3. Resend shows the records. Usually:

| Type | Host (Namecheap/GoDaddy style, root domain left off) | Value |
|---|---|---|
| TXT | `resend._domainkey.mail` | the long DKIM key (`p=...`) |
| MX | `send.mail` | `feedback-smtp.<region>.amazonses.com`, priority 10 |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` |
| TXT (recommended) | `_dmarc.mail` | `v=DMARC1; p=none;` |

**Copy the values from Resend's page, not from this table.**

### 4. Add the records at the DNS provider (owner's OK)

- **Namecheap / GoDaddy / Aliyun:** the Host field already ends in the domain. Type only `resend._domainkey.mail`, not the full name, or it becomes `...labpencil.com.labpencil.com`. The check script detects this mistake (`doubled-host`).
- **Namecheap:** MX records go in the same Advanced DNS list. If "Mail Settings" is set to something other than Custom MX, the MX row may be hidden. Set it to **Custom MX**. This only affects the root domain when the host is `@`. Ours is `send.mail`.
- **Cloudflare:** grey cloud (DNS only) for everything. Proxied records break verification.
- Don't touch existing MX/TXT records for the root domain. Those are their current mailbox.

Then check (read-only):

```bash
node <skill-dir>/scripts/check.mjs --domain mail.example.com --wait 900
```

| Code | Meaning |
|---|---|
| `dkim` / `spf` / `mx` | That record isn't visible yet, or the value is wrong |
| `doubled-host` | The full domain was typed into Host; keep only the part before it |
| `dmarc` (○, recommended) | No DMARC yet. Add `v=DMARC1; p=none;` on `_dmarc.<sending domain>` |

When it passes, click **Verify** in Resend (often verified within 15 minutes; DNS can take up to 72 h).

### 5. API key and variables (owner pastes the key)

1. Resend → **API Keys → Create API key**, permission **Sending access**, domain = the sending domain.
2. The owner copies it into Vercel → project → **Settings → Environment Variables**:

| Name | Value | Secret? |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | **yes**: owner only, mark Sensitive |
| `EMAIL_FROM` | `我的小店 <hello@mail.example.com>` | no |
| `EMAIL_TEST_TO` | the owner's own inbox | no |

You may add the two non-secret ones yourself with the owner's OK.

3. Redeploy so the variables take effect.

### 6. Test

Open `https://<domain>/email-test` → **给我发一封测试邮件**. The page only ever emails `EMAIL_TEST_TO`, at most once a minute and 10 times a day, so it can't be abused. Ask the owner whether it arrived in the **inbox** (not spam). In Gmail → ⋮ → Show original, SPF, DKIM and DMARC should all show PASS.

## Using it in code

```ts
import { sendEmail } from "@/lib/email";
const r = await sendEmail({ to, subject: "你的验证码", text: `验证码：${code}`, tag: "login-code" });
if (!r.ok) /* show a friendly error; r.error has details */;
```

Every send records `email.sent` or `email.failed` in `core_events` with a masked address (`zh***@gmail.com`), so other systems can react without exposing addresses.

## Tell the user (short)

"Your site can now send email from hello@<sending domain>, free up to 3,000 emails a month and 100 a day." Add one line: next is `auth-login` (episode 006), which uses this to send login codes.
