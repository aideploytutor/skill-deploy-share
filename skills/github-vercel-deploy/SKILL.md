---
name: github-vercel-deploy
description: Deploy a local project folder from scratch to a new GitHub repo and connect it to Vercel so every push auto-deploys. Use when the user says "deploy to GitHub and Vercel", "put this project online", "ship this to Vercel", or "部署到 GitHub 和 Vercel / 把这个项目上线".
license: MIT
metadata:
  version: "2.0.0"
  requires: "git, Node.js 18+, GITHUB_TOKEN, VERCEL_TOKEN (CLI mode) or a browser tool (browser mode)"
---

# GitHub + Vercel deploy

Goal: take a project folder, push it to a GitHub repo, create a Vercel project linked to that repo, deploy to production, and verify. Every later `git push` auto-deploys.

This skill follows the open Agent Skills format (`SKILL.md` + `scripts/` + `references/`) and works in any agent that can run a shell command: Claude Code, Claude desktop/web, Cursor, VS Code Copilot, OpenAI Codex, Gemini CLI, Windsurf, or a plain CI job.

## Pick a mode

| Your agent can... | Use |
|---|---|
| run shell commands on the machine that has the project (Claude Code, Cursor, Copilot agent mode, Codex, Gemini CLI, a terminal) | **CLI mode** (below), the default |
| only use a browser plus a sandbox that cannot reach api.vercel.com (for example a cloud chat session) | **Browser mode**: follow `references/browser-mode.md` |

## Rules (always)

- Never type passwords, create accounts, solve CAPTCHAs, or change account settings for the user. Logins, sign-ups, OAuth approvals, and linking or unlinking accounts are done by the user.
- Never ask the user to paste a token into the chat. Tokens go in environment variables or an `.env.deploy` file that the user edits themselves.
- Before creating a repo or deploying, confirm with the user: repo name, Public or Private (default **Private**), and any environment variables. Then run with `--yes`.
- Never `git push --force`. Never delete repos or Vercel projects.

## CLI mode

The script `scripts/deploy.mjs` does everything through the GitHub and Vercel REST APIs. It needs only `git` and Node 18+, with no `gh` or `vercel` CLI and no interactive login, so it cannot hang. Resolve the script path relative to this SKILL.md.

### 1. Preflight (no changes)

```bash
node <skill-dir>/scripts/deploy.mjs --dir <project> --check
```

- **Exit 2, missing or invalid token**: show the user the two links the script prints and ask them to create the tokens and put them in `<project>/.env.deploy` or `~/.env.deploy`:
  ```
  GITHUB_TOKEN=...   # https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy
  VERCEL_TOKEN=...   # https://vercel.com/account/tokens
  ```
  If `gh` is installed and logged in, the GitHub token is picked up automatically. Wait for the user to say done, then run the check again.
- **Exit 3, git or Node missing**: show the printed install command. On Windows, tell the user to open a **new** terminal after installing so that PATH refreshes.
- On success the check prints the GitHub login, the Vercel user, and whether the repo and project already exist. Use these in your confirmation question.

### 2. Confirm, then deploy

Ask: "I'll create a **private** repo `<login>/<name>` and deploy it to Vercel. OK?" Once the user agrees:

```bash
node <skill-dir>/scripts/deploy.mjs --dir <project> --name <name> --yes --json
# add --public if the user wants a public repo; --framework nextjs|vite|... if auto-detect is wrong
```

The script:
1. adds `.gitignore` entries (`node_modules/`, `.env*`, `.env.deploy`, `.vercel`)
2. scans for secrets and **aborts before pushing** if it finds any
3. runs `git init` and commits
4. creates the GitHub repo
5. pushes, passing the token through env so it never lands in `.git/config`
6. creates or links the Vercel project
7. triggers a production deploy, waits for READY, and checks the live URL

Re-running is safe because completed steps are skipped.

### 3. Handle failures by exit code

| Exit | Meaning | What you do |
|---|---|---|
| 2 | token missing or invalid | step 1 again |
| 5 | secrets found | show the files and ask the user whether to ignore or remove them. Never add `--allow-secrets` unless the user confirms it's a false positive |
| 6 | Vercel can't see the repo | the most common cause is that the **GitHub account linked in Vercel is not the repo owner**. Send the user to https://vercel.com/account/settings/authentication to Disconnect and Connect the right account, and to https://github.com/apps/vercel/installations/new to grant repo access. Then re-run |
| 7 | build failed | open the printed inspector URL or read the build log, fix the code, then re-run |
| 10 | needs confirmation | ask the user, then re-run with `--yes` |

More cases: `references/troubleshooting.md`.

### 4. Report

Tell the user, briefly:
- the repo URL and the live URL from the `--json` output
- "pushing to `main` auto-deploys, and other branches get preview URLs"
- anything they still need to do

Do not paste tokens or the full log.
