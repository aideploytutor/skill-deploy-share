# Putting your domain on Cloudflare

Your site runs on Cloudflare Workers; a custom domain on a Worker needs the domain's DNS on Cloudflare. Free.

## If you don't have a domain yet

Cloudflare → Domains → **Buy a domain**. Cloudflare Registrar sells at cost and renews at the same price. Done: skip to "Attach it to the Worker".

## If you bought it elsewhere (Namecheap, GoDaddy, Aliyun, Porkbun…)

1. Cloudflare → **Add a domain** → `example.com` → **Free** → "Import DNS records automatically".
2. **Compare the imported list with your registrar's DNS before going on.** The automatic scan only finds common names. In our test (2026-10-25) it imported the root `A`, `shop`, `MX`, SPF and `_dmarc.mail`, but **missed**:
   - `send.mail` (CNAME or MX + TXT): Resend's return path
   - `resend._domainkey.mail` (TXT): Resend's DKIM signature

   Missing email records = login codes stop arriving. Add every missing record with **Proxy status: DNS only** (grey cloud). Email records must never be proxied.
   Tip: look them up first, e.g. `https://cloudflare-dns.com/dns-query?name=resend._domainkey.mail.example.com&type=TXT` with header `accept: application/dns-json`.
3. Records pointing at your old host (e.g. a `CNAME` to `vercel-dns…`): set them to **DNS only** for now so nothing breaks while you switch.
4. Cloudflare shows two nameservers (`xxx.ns.cloudflare.com`). At your registrar:
   - **Namecheap:** Domain List → Manage → Nameservers → **Custom DNS** → paste both → ✓
   - **GoDaddy:** My Products → DNS → Nameservers → Change → "I'll use my own"
   - **Aliyun / Tencent:** 域名列表 → 管理 → DNS 修改 → 修改 DNS 服务器
5. Usually active within minutes, sometimes a few hours. Cloudflare emails you; the domain overview says "active".

**Registrar email forwarding** (e.g. Namecheap's `eforward` MX) stops working once the nameservers move. If you used it, turn on Cloudflare → Email → **Email Routing** (free) and re-create the forwarding there.

## Attach it to the Worker

Worker → Settings → **Domains** → Add Domain → pick the domain → subdomain (e.g. `shop`) → Add.

If Cloudflare says *"Hostname already has externally managed DNS records"*, delete the old record for that exact name (DNS → Records → Edit → Delete), then add again. Expect 1–2 minutes of downtime on that hostname while the certificate is issued.

## After moving an existing site

Update everything that knows the old address:

- `NEXT_PUBLIC_SITE_URL` (Worker → Settings → Variables and Secrets)
- Creem → Developers → Webhooks → the endpoint URL
- `.github/workflows/pay-reconcile.yml` → `SITE_URL`, push
- Google sign-in: add `https://<domain>/api/auth/callback/google` to the OAuth client
- Sign-in sessions are per domain: everyone signs in once more
- Worker → Settings → **Builds → Variables and secrets** → `DATABASE_URL` (migrations run in the build)
- Your old host: disconnect its Git integration so pushes deploy only to Cloudflare
