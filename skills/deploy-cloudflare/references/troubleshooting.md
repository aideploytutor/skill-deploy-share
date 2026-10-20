# deploy-cloudflare troubleshooting

All of these were hit in the live test and are fixed by `apply.mjs`; they're here for projects patched by hand.

| What you see | Why | Fix |
|---|---|---|
| `/api/health` → database `error`; log: `CONNECT_TIMEOUT ...:5432` | Next.js bundled the Node build of `postgres`, which can't open sockets on Workers | `serverExternalPackages: ["postgres"]` in `next.config` |
| First request works, later ones fail | A database client (or Better Auth instance) created once and reused across requests | Create per request on Workers (`src/db/index.ts`, `getAuth()`) |
| "This page couldn't load" after signing in; log: `[Better Auth] Failed to get session` | Same as above, inside auth | auth-login ≥ 1.1.1, or run `apply.mjs` |
| Upload stuck at 100%; log: `ALPNProtocols option is not implemented` | `@vercel/blob`'s server SDK uses a Node-only HTTP client | file-upload ≥ 1.0.1 (plain `fetch`) |
| Deploy fails: "you should use a local Postgres connection string to emulate Hyperdrive" | `opennextjs-cloudflare deploy` reads bindings for local emulation | `localConnectionString` placeholder in the hyperdrive binding |
| Variables vanish after a code deploy | Wrangler replaces dashboard variables with the config's | `"keep_vars": true` in `wrangler.jsonc` |
| Each query ~0.5 s | New connection per request, far from the database | Hyperdrive (free) |
| Error 1102 / "Exceeded CPU" | Free plan: 10 ms CPU per request (not always enforced) | Workers Paid, $5/month |
| Error 1027 | Free plan: 100,000 requests a day | Wait for midnight UTC, or Workers Paid |
| `/login` setup page mentions Vercel | Text written for Vercel | Same variables go in Cloudflare → Settings → Variables and Secrets |
