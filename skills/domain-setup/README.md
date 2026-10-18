# domain-setup (episode 004)

Point your own domain, or a subdomain such as `shop.yourdomain.com`, at your site on Vercel. The HTTPS certificate is issued and renewed automatically. Sending email from your own domain (next episode) depends on this step.

## Tell your AI

> Use domain-setup to connect my domain to my site

## Live test (2026-10-14)

- Registrar: Namecheap; connected the subdomain `shop.labpencil.com`, the main site was untouched
- Added 1 CNAME record; the site was reachable after about 2 minutes. It failed for the first minute because the HTTPS certificate was still being issued
- Gotcha: Vercel's API returned the legacy value `cname.vercel-dns.com`, while the Domains page said "DNS Change Recommended" and showed a project-specific `xxxx.vercel-dns-017.com`. The legacy value still works, but **use the value shown on Vercel's Domains page**

## No domain yet?

- We recommend **Cloudflare Registrar**: sold at cost, and renewals cost the same as the first year (`.com` was $10.46/year when checked on 2026-10-14)
- Watch out for "$1 the first year, $40 to renew" deals; always check the renewal price
- Prefer `.com`; unusual TLDs are more likely to be treated as spam by email providers

## Common problems

| Symptom | Cause |
|---|---|
| Site won't open right after adding the record | DNS is still propagating or the certificate is still being issued; wait a few minutes |
| "Too many redirects" or certificate errors | Cloudflare's orange-cloud proxy is on; switch it to grey (DNS only) |
| You still see the old site | The same hostname still has an old A/CNAME record; delete it once you've confirmed |
| Slow or blocked in mainland China | Vercel says `.vercel.app` may be blocked there; your own domain helps but access isn't guaranteed |

## Checker script (read-only, changes nothing)

```bash
node scripts/check.mjs --domain shop.example.com --wait 600
node scripts/check.mjs --domain example.com --www
```

It checks the DNS records, HTTPS, whether the orange-cloud proxy is on, CAA records, and whether you're still on Vercel's legacy value.
