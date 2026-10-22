# skill-deploy-share

**Production-grade on a shoestring.** Reusable AI agent skills that take a vibe-coded project all the way to a real product: deployed, on your own domain, with a database, email, sign-in and (soon) payments. Each skill is tested live on real accounts before it ships, and the default stack starts on free tiers.

Every skill is a folder in the open **Agent Skills** format (`SKILL.md` + scripts + reference docs). Write it once and it works across AI coding tools, and most scripts also run on their own as command-line tools.

## Can't code? Start here

You don't need to understand anything below. Open the AI coding tool you already use (Claude Code, Cursor, VS Code Copilot…) and send it this:

> Install the skills from github.com/aideploytutor/skill-deploy-share

Then just tell your AI what you want in plain words, for example:

> Deploy this project to GitHub and Vercel

Whenever a step needs a sign-in or an approval, the AI stops and tells you what to click. Passwords and sign-ins are always done by you; the AI never touches your accounts.

## Roadmap and stack

- [ROADMAP.md](ROADMAP.md): the 100-skill roadmap, from the foundation and payments to 20 complete systems
- [STACK.md](STACK.md): the stack and conventions every skill shares, with verified free-tier limits

## Skills

| Skill | What it does | Docs |
|---|---|---|
| [github-vercel-deploy](skills/github-vercel-deploy/) | Push a local project to a new GitHub repo, connect Vercel and go live; every push redeploys automatically | [README](skills/github-vercel-deploy/README.md) |
| [app-foundation](skills/app-foundation/) | Set up a product foundation in one sentence: web framework, database layer and project rules that every later system builds on | [README](skills/app-foundation/README.md) |
| [db-connect](skills/db-connect/) | Connect a free database (Neon, created from the Vercel dashboard); tables are created on every deploy | [README](skills/db-connect/README.md) |
| [domain-setup](skills/domain-setup/) | Put your own domain or subdomain on the site with automatic HTTPS, plus a checker script | [README](skills/domain-setup/README.md) |
| [email-send](skills/email-send/) | Send email from your own domain (Resend, 3,000 free a month), with a DNS checker and a test page | [README](skills/email-send/README.md) |
| [auth-login](skills/auth-login/) | Sign in with Google or a 6-digit email code; users live in your own database, no per-user fees | [README](skills/auth-login/README.md) |
| [env-secrets](skills/env-secrets/) | Keep API keys safe: scan for leaked keys, block commits that contain one, and replace a leaked key | [README](skills/env-secrets/README.md) |
| [file-upload](skills/file-upload/) | Let signed-in users upload images and PDFs to Vercel Blob (free, no card); files survive every deploy | [README](skills/file-upload/README.md) |
| [deploy-cloudflare](skills/deploy-cloudflare/) | Move off Vercel Hobby (non-commercial only) to Cloudflare Workers so the site can charge; GitHub auto-deploys, free Hyperdrive database pooling | [README](skills/deploy-cloudflare/README.md) |
| [pay-checkout](skills/pay-checkout/) | A Buy button with Creem (merchant of record, pays out to mainland China banks too), test mode first, payments recorded via a signed webhook | [README](skills/pay-checkout/README.md) |
| [db-backup](skills/db-backup/) | Daily encrypted database backup on GitHub Actions (free), kept 30 days, one-click restore into a database you choose | [README](skills/db-backup/README.md) |

> When you add a skill, add a row here and in `AGENTS.md`.

## Supported tools

| Tool | User-level folder | Project-level folder |
|---|---|---|
| Claude Code / Claude desktop | `~/.claude/skills/` | `.claude/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |
| VS Code + GitHub Copilot | `~/.copilot/skills/` | `.github/skills/` |
| OpenAI Codex | `~/.agents/skills/` | `.agents/skills/` |
| Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| Other agents / your own software / CI | Have the agent read `AGENTS.md`, or run a skill's `scripts/` directly | |

If a tool changes its folder in a new version, update the `AGENTS` config at the top of `install.mjs`.

## Install

Requires Node.js 18 or newer.

```bash
git clone https://github.com/aideploytutor/skill-deploy-share
cd skill-deploy-share

node install.mjs                               # every skill, every tool (user level)
node install.mjs --agent claude,cursor         # only these tools
node install.mjs github-vercel-deploy          # only this skill
node install.mjs --project ../my-app           # into a project, so your team gets it on commit
node install.mjs --list                        # list skills and install paths
```

Or use the community installer: `npx skills add aideploytutor/skill-deploy-share`.

To update: `git pull`, then run `node install.mjs` again; it overwrites the old version.

## Usage

Restart your IDE or start a new chat after installing. Then describe what you want in plain language; there are no commands to memorize. The agent picks the right skill from each skill's `description`, for example "deploy this project to GitHub and Vercel".

Most skills keep their core logic in `scripts/`, which you can also run without an AI. See each skill's README.

## Repository layout

```
skill-deploy-share/
├── README.md              ← this file: the catalog
├── AGENTS.md              ← instructions and skill index for any agent
├── CLAUDE.md              ← points to AGENTS.md
├── install.mjs            ← cross-platform installer
├── templates/
│   └── SKILL.template.md  ← template for new skills
└── skills/
    └── <skill-name>/
        ├── SKILL.md       ← required: when to use it + steps (what the agent reads)
        ├── README.md      ← recommended: notes for humans
        ├── scripts/       ← optional: executable scripts
        └── references/    ← optional: troubleshooting and deeper docs (loaded on demand)
```

## Adding a skill

1. **Create the folder**: `skills/<skill-name>/`, lowercase letters, numbers and hyphens only.
2. **Write SKILL.md**: copy `templates/SKILL.template.md`.
   - `name` must match the folder name.
   - `description` is the only thing the agent uses to decide whether to use the skill. Say what it does and how users will phrase the request.
   - Keep the body under 500 lines; put details in `references/`.
3. **Write scripts** (if needed):
   - Prefer Node (`.mjs`) or Python so they run on Windows, macOS and Linux; avoid `.sh`/`.ps1` that only work on one platform.
   - No interactive prompts. When confirmation is needed, use an exit code or a `--yes` flag and let the agent ask the user.
   - Provide `--help`, and `--json` output where a program might call it.
4. **Write README.md**: what it's for, prerequisites, examples and known issues.
5. **Register it**: add a row to the skill tables in this file and in `AGENTS.md`.
6. **Test it**: install it into a test project with `node install.mjs <skill-name> --project <test-dir>` and run it end to end in at least one agent.

## Principles every skill follows

- **Account actions belong to the user.** The agent never types passwords, creates accounts, solves CAPTCHAs or changes account settings. It asks the user to do those steps.
- **Keys stay out of chats and repos.** Tokens live in environment variables or git-ignored files, and scripts check for leaked secrets before committing.
- **Confirm before changing things.** Before creating, publishing or deleting anything, the agent says what it will do and waits for a yes.
- **Safe to re-run.** Finished steps are skipped automatically; after fixing a failure, just run it again.

## License

MIT. See [LICENSE](LICENSE).
