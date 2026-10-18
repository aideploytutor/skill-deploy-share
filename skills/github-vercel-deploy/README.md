# github-vercel-deploy (episode 001)

Push a local project to a new GitHub repo, create a Vercel project connected to it, and go live. After that, every push to `main` updates the site automatically, and other branches get preview links.

## Use it from your agent

After installing the skills (see the [main README](../../README.md#install)), open your project and tell your agent:

> Deploy this project to GitHub and Vercel

The agent will:
1. check your environment and accounts;
2. confirm the repo name and whether it's public or private (private by default);
3. run the deploy script;
4. give you the repo URL and the live URL.

## Prerequisites

- git, and Node.js 18 or newer
- Two tokens in `.env.deploy` in the project, or `~/.env.deploy` in your home folder. The file is git-ignored automatically. **Don't paste these into a chat**:

```
GITHUB_TOKEN=...   # https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy
VERCEL_TOKEN=...   # https://vercel.com/account/tokens
```

If `gh` is installed and signed in, the GitHub token is picked up automatically.

## Run it as a command-line tool

```bash
node scripts/deploy.mjs --dir ../my-app --check        # check only, change nothing
node scripts/deploy.mjs --dir ../my-app --yes          # deploy (private repo)
node scripts/deploy.mjs --dir ../my-app --yes --public # deploy (public repo)
node scripts/deploy.mjs --dir ../my-app --yes --json   # JSON output for programs or CI
node scripts/deploy.mjs --help                         # all options
```

| Exit code | Meaning |
|---|---|
| 0 | Success |
| 2 | Token missing or invalid |
| 3 | git or Node missing |
| 5 | Possible secret found; stopped before pushing |
| 6 | Vercel can't see the GitHub repo (usually an account mismatch) |
| 7 | Deploy or build failed |
| 10 | Needs the user's confirmation (re-run with `--yes`) |

## No command line?

Some environments can't run scripts locally or can't reach Vercel's API, such as cloud chat sessions. See [references/browser-mode.md](references/browser-mode.md): the agent drives a browser to create the repo and import it into Vercel. This flow has been tested end to end.

## Known issues and fixes

| Problem | Fix |
|---|---|
| Windows says `gh` is "not recognized" after installing it | No longer depends on the `gh` or `vercel` CLIs |
| `vercel login` hangs at "Waiting for authentication..." | Uses `VERCEL_TOKEN` instead of interactive login |
| Had to double-click a `.bat` file | The agent runs the script; when confirmation is needed it exits with code 10 and the agent asks in the chat |
| Garbled characters in PowerShell scripts | Rewritten as a Node script |
| Vercel's linked GitHub account doesn't own the repo, so Deploy does nothing | Detected automatically, with steps to fix |
| Cloud sessions can't create repos through the API | Use browser mode |

More troubleshooting in [references/troubleshooting.md](references/troubleshooting.md).
