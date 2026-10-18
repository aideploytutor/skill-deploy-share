---
name: domain-setup
description: Point the user's own domain (or a subdomain like shop.example.com) at their Vercel site with automatic HTTPS, at any registrar (Cloudflare, Namecheap, GoDaddy, Aliyun...), then verify it. Use when the user says "connect my domain", "use my own URL", or a later skill (email-send) requires a domain.
license: MIT
metadata:
  version: "1.0.0"
  episode: "004"
  requires: "github-vercel-deploy"
  provides: "custom domain on the Vercel project with HTTPS; stack.json domain; NEXT_PUBLIC_SITE_URL"
---

# domain-setup

Goal: the site opens at the user's own address with the padlock (HTTPS). A domain is also what episode 005 (`email-send`) needs to send email to anyone. Follow `../../STACK.md`.

Buying a domain, signing in to the registrar, and saving DNS changes are the **user's** actions or need their explicit OK. You can prepare everything and fill in forms once they say yes. Never ask for the registrar password.

## 0. No domain yet? Help them buy wisely

- Recommend **Cloudflare Registrar**. It sells at cost, and **renewal costs the same as the first year** (`.com` was $10.46/yr when checked on 2026-10-14). Check the current price before quoting it.
- Warn about the classic trap: a cheap first year with an expensive renewal. Always look at the renewal price.
- Prefer `.com`. Avoid odd TLDs that some email providers treat as spam.
- The user buys it themselves.

## 1. Decide which address

| Situation | Use |
|---|---|
| New domain, this is the main product | `www.example.com`, with `example.com` redirecting to it (Vercel's recommendation) |
| Domain already runs another site | a subdomain such as `shop.example.com`, which leaves the existing site untouched |

Before changing anything, look up what the domain points to now:

```bash
node <skill-dir>/scripts/check.mjs --domain example.com
```

If the root already serves something, **don't touch the root**. Use a subdomain.

## 2. Add the domain in Vercel

Go to Vercel → project → **Settings → Domains → Add**, and enter the domain. For a root domain, accept Vercel's offer to add `www` and redirect.

Vercel then shows the record(s) to create:
- a root domain uses an **A** record
- a subdomain uses a **CNAME** record

**Copy the values from the project's Domains page in the dashboard, not from the API or an old tutorial.** In testing, the API suggested the legacy `cname.vercel-dns.com`, while the Domains page showed "DNS Change Recommended" with a project-specific `xxxx.vercel-dns-017.com`. Legacy values still work, but use the recommended one. They differ between projects, for example `76.76.21.21` or `216.198.79.1` for A records, and `cname.vercel-dns.com` or `xxxx.vercel-dns-017.com` for CNAMEs.

## 3. Create the record at the DNS provider (user's OK required)

Show the user exactly what will be added:

| Type | Host | Value |
|---|---|---|
| CNAME | `shop` (or `www`) | the value from Vercel |
| A | `@` (root) | the value from Vercel |

Then follow the instructions for their DNS provider:

- **Namecheap:** Domain List → Manage → **Advanced DNS** → Add New Record.
- **Cloudflare:** DNS → Records → Add record. Set Proxy status to **DNS only (grey cloud)**. Vercel does not recommend a proxy in front of it; the orange cloud is the #1 cause of "too many redirects" and certificate errors.
- **Aliyun / Tencent Cloud / GoDaddy:** the same record, added in their DNS console.

Delete any old **A/AAAA/CNAME records for the same host** only with the user's OK. Never delete MX or TXT records, because those are their email and verifications.

## 4. Verify (DNS can take a few minutes)

```bash
node <skill-dir>/scripts/check.mjs --domain shop.example.com --wait 600
# root domain + www:
node <skill-dir>/scripts/check.mjs --domain example.com --www --wait 600
```

| Problem code | Meaning |
|---|---|
| `no-dns` | The record isn't visible yet, or the Host was typed wrong |
| `cloudflare-proxy` | The orange cloud is on; turn it grey |
| `not-vercel` | The record points to an old host |
| `vercel-404` | The domain wasn't added to the project in Vercel |
| `cert-pending` | Vercel is still issuing the certificate; wait |
| `caa` | A CAA record blocks Let's Encrypt; add `0 issue "letsencrypt.org"` |

Exit code 0 means everything is fine. Exit code 2 means not ready, with a fix printed for each problem.

## 5. Tell the project its address

Add `NEXT_PUBLIC_SITE_URL=https://<domain>` in Vercel → Settings → Environment Variables (Production). It isn't a secret. Then record it in the project:

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --domain "<domain>"
```

This writes `stack.json` → `domain`, documents `NEXT_PUBLIC_SITE_URL` in `.env.example`, and makes a git save point. Push, so the next deploy uses it.

## Tell the user (short)

"Your site is now at https://<domain> with HTTPS, renewed automatically." Then add two notes:

- **Mainland China:** Vercel says `.vercel.app` addresses can be blocked or slow there, and a custom domain is the first recommended step. It helps, but nothing guarantees access in China.
- **Next:** `email-send` (episode 005) uses this domain so emails reach everyone and don't land in spam.
