# A key leaked: how to replace it (by provider)

Deleting the message, the file or the commit is **not** enough. Copies may already exist in chat history, in forks, caches and bots that scrape public repos. **Revoke the old key and create a new one.** Then the leaked copy is useless.

Order matters: create the new key → put it in Vercel → redeploy → revoke the old one. That way the site never goes down. If the key might already be in use by someone else, revoke first and accept a few minutes of downtime.

| Key | Where to replace it | Side effects |
|---|---|---|
| `RESEND_API_KEY` | resend.com → API Keys → create (Sending access, one domain) → delete the old one | none |
| `GOOGLE_CLIENT_SECRET` | Google Cloud → Google Auth Platform → Clients → your client → add a new secret, then disable/delete the old one | none once the new one is deployed |
| `BETTER_AUTH_SECRET` | generate a new random value (the site's `/login` setup screen, or any 32+ character random string) | **everyone is signed out** once |
| `DATABASE_URL` (Neon) | Vercel → Storage → your database → reset the password (or Neon console → Roles → reset) | Vercel's integration updates the variables; redeploy |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → roll key | set an expiry for the old key if you need a grace period |
| GitHub token | github.com → Settings → Developer settings → tokens → delete | none |
| OpenAI / Anthropic / other AI keys | the provider's API keys page → revoke → create | check the usage page for spend you don't recognise |

After rotating, run `npm run secrets:scan -- --history`. If the old key is still in git history of a **public** repo, it no longer matters once revoked, but you can also make the repo private.

Never paste a key into a chat with any AI or person. If it happened: rotate. That's the whole fix.
