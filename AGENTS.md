# Agent instructions

This repository holds portable agent skills. Each skill lives in `skills/<name>/` and contains:
- `SKILL.md`: when to use the skill and the steps to follow
- `scripts/`: helper scripts
- `references/`: deeper docs

## Using a skill
When a user request matches a skill's `description`:
1. Read that skill's `SKILL.md`.
2. Follow it.
3. Run the scripts it mentions, with paths resolved relative to the skill folder.

## Skills in this repo

| Skill | Use when |
|---|---|
| [github-vercel-deploy](skills/github-vercel-deploy/SKILL.md) | The user wants a local project pushed to a new GitHub repo and deployed on Vercel with auto-deploy on push. Example phrasings: "部署到 GitHub 和 Vercel", "ship this to Vercel". |

## Adding a skill
1. Copy `templates/SKILL.template.md` to `skills/<new-name>/SKILL.md`.
2. Fill in the frontmatter (`name` must equal the folder name; `description` says when to use it).
3. Add a row to the table above and to README.md.
4. Keep scripts cross-platform. Prefer Node (`.mjs`) or Python over `.sh`/`.ps1`.
