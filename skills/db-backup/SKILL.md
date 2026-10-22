---
name: db-backup
description: Back up an app-foundation project's Postgres database every day with GitHub Actions (free), AES-256 encrypted, checked readable, kept 30 days, plus a one-click restore workflow that refuses production by default. Use when the user says "back up my database", "what if I lose my data", "daily backup", "restore my database", "I deleted data by mistake", or another skill requires db-backup.
license: MIT
metadata:
  version: "1.0.0"
  episode: "011"
  requires: "db-connect; the project on GitHub (github-vercel-deploy)"
  provides: ".github/workflows/db-backup.yml (daily, manual too), .github/workflows/db-restore.yml; db.backed_up event"
---

# db-backup

Goal: every day GitHub Actions dumps the production database, encrypts it, proves the file can be opened, and keeps it 30 days; one button restores any backup into a database the owner picks. Follow `../../STACK.md`.

## Why (say this to the owner)

- Neon Free can only rewind **6 hours**, keeps 1 manual snapshot and has no scheduled backups (https://neon.com/docs/introduction/plans). A mistake noticed tomorrow is gone.
- GitHub Actions is free: public repos unlimited, private repos 2,000 minutes a month; a backup takes about a minute. Private-repo artifacts share 500 MB of storage (https://docs.github.com/en/billing/concepts/product-billing/github-actions). Re-check both pages before quoting.
- Backups are encrypted, so they're safe even in a public repo (where anyone signed in can download artifacts).

## Rules

- The owner adds the secrets in GitHub's settings. Never read, print, copy or type `DATABASE_URL`, `DB_BACKUP_PASSPHRASE` or `DB_RESTORE_URL`, and never ask for them in chat.
- The passphrase is the only key to the backups. Tell the owner to generate it in a password manager and keep it there. Without it, backups can't be opened.
- Restore never goes into production on the agent's initiative. Restore into a new, empty database first; switching the site over (`DATABASE_URL` in the host) is the owner's decision.
- Never "test" by deleting production data. Practise on the restore database.

## Steps

### 1. Add the workflows

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json   # --hour 0-23 (UTC), --keep 1-90 days
```

Adds `db-backup.yml`, `db-restore.yml`, the `.env.example` note, `stack.json` → `installed`, a git save point. Push.

### 2. Owner: two secrets (a phone works)

`https://github.com/<owner>/<repo>/settings/secrets/actions` → **New repository secret**:
1. `DATABASE_URL`: Neon → project → **Connect** → copy the connection string (pooled is fine; the workflow switches to direct).
2. `DB_BACKUP_PASSPHRASE`: 16+ random characters from a password manager, saved there too.

### 3. First backup

`https://github.com/<owner>/<repo>/actions` → **Database backup** → **Run workflow**. About a minute later: green ✅; the run summary lists every table with its row count; the artifact `db-backup-YYYY-MM-DD` holds `db.dump.enc` and `row-counts.txt`. From then on it runs daily at 03:17 UTC.

### 4. Restore drill (do it once)

1. Owner: Neon → **Databases → New database** (e.g. `restore_drill`) → **Connect**, pick that database → copy → GitHub secret `DB_RESTORE_URL`.
2. **Actions → Database restore → Run workflow**, type `RESTORE` (run ID empty = latest backup).
3. Summary: every table with "Rows in backup" = "Rows now". Neon → Tables on `restore_drill` shows the data.

Real recovery is the same: restore into a new database, check it, then the owner points `DATABASE_URL` (host settings, e.g. Cloudflare → Variables) at it, or copies back only the rows they lost.

## How it works

- `pg_dump --format=custom` with the client matching the server's major version (Docker `postgres:<major>-alpine`), then `openssl enc -aes-256-cbc -pbkdf2 -iter 200000`.
- Before uploading, the encrypted file is decrypted and listed with `pg_restore --list`; no table data → the run fails.
- Restore: `pg_restore --clean --if-exists --no-owner --no-acl --single-transaction`, so it's all or nothing. It refuses when `DB_RESTORE_URL` points at the same database as `DATABASE_URL` unless the confirm box says `RESTORE PRODUCTION`.
- On success the backup inserts `db.backed_up` into `core_events` (payload: day, bytes, tables, rows).

## Troubleshooting

See `references/troubleshooting.md`.
