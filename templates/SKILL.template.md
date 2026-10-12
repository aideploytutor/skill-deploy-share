---
name: my-skill-name            # lowercase, hyphens, must match the folder name
description: One sentence on what it does and exactly when to use it (include trigger phrases).
license: MIT
metadata:
  version: "1.0.0"
---

# Title

Goal: what the user ends up with.

## Rules
- Things the agent must never do on the user's behalf (passwords, account changes, force-push...).
- What to confirm with the user before acting.

## Steps
1. Preflight / checks (no changes).
2. Confirm with the user.
3. Do the work (prefer a script in `scripts/` over long inline commands).
4. Verify.
5. Report briefly.

## Troubleshooting
Point to `references/troubleshooting.md` for detail.
