# Troubleshooting

Each entry below was hit during real test runs.

## Windows: `gh` / `vercel` "is not recognized" right after installing
The installer (winget or npm -g) updates PATH, but terminals that are already open don't pick up the
change. Two ways out:
- Open a **new** terminal.
- Avoid the problem: `scripts/deploy.mjs` doesn't need `gh` or `vercel` at all. It only needs `git`
  and `node`.

## `vercel login` sits at "Waiting for authentication..."
It isn't hung. It's waiting for someone to open the printed `https://vercel.com/oauth/device?user_code=...`
link and approve it. An agent can't do that step for the user.
- Fix: use `VERCEL_TOKEN` instead. The script never starts an interactive login.

## Deploy button does nothing / "repository was not found" / "install the GitHub integration first"
The GitHub account linked in Vercel isn't the account that owns the repo. Typical case: Vercel was
created with Google or another GitHub user.
- Fix: open https://vercel.com/account/settings/authentication → GitHub row → Disconnect → Connect the
  owner account.
- Also check https://github.com/apps/vercel/installations/new → Repository access.

## `HTTP 403 ... sessions are bound to their configured repositories` (Claude cloud sessions)
The session's GitHub proxy only allows repo-scoped endpoints. It can't create repos or call GraphQL.
- Fix: create the repo in the browser, attach it to the session, then push. See browser-mode.md.
- `gh repo view` uses GraphQL. Use the REST equivalent instead: `gh api repos/<o>/<r>`.

## Creating a repo fails with 403 / 404 (CLI mode)
The token can't create repos. You have two options:
- Use a classic token with the `repo` scope, or a fine-grained token with **Administration: Read and
  write** on "All repositories".
- Pre-create an empty repo at https://github.com/new, then re-run the script.

## Push rejected (non-fast-forward)
The remote has commits that the local copy doesn't.
- Fix: `git pull --rebase origin main`, then re-run.
- Never force-push.

## Build fails on Vercel
Read the build log at the inspector URL the script prints.
- Common causes: a wrong framework preset (pass `--framework`), a missing env var (add it in Project →
  Settings → Environment Variables), or the wrong Node version (set `engines.node` in package.json).

## The live URL returns 401
Vercel Deployment Protection is on for the project. Turn it off for Production under Project → Settings
→ Deployment Protection, if the site is meant to be public.

## PowerShell shows garbled Chinese text in .ps1 scripts
Windows PowerShell 5.1 reads BOM-less UTF-8 files as ANSI. Either save the file as UTF-8 **with BOM** or
use Node scripts instead. That's why this skill ships `deploy.mjs` rather than a `.ps1`.
