# db-backup

Your database, backed up every day, for free. GitHub Actions copies it, encrypts it, checks the copy opens, and keeps 30 days of them. If something goes wrong, one button puts a backup back.

## Why you need it

Neon's free plan can only rewind **6 hours**. Delete the wrong thing tonight, notice tomorrow, and it's gone. With this skill you can go back to any day in the last 30.

## What you get

- **Database backup** workflow: runs every day (and whenever you press Run), encrypted with your passphrase, row count of every table in the summary
- **Database restore** workflow: type `RESTORE`, pick a backup (or the latest), and it goes into a database you choose. All or nothing. It won't touch production unless you type `RESTORE PRODUCTION`.

## Before you start

- `db-connect` installed, the project on GitHub (episode 001)

## Use it

Tell your AI:

> Back up my database every day with the db-backup skill

Then on GitHub (a phone works): repo → **Settings → Secrets and variables → Actions → New repository secret**:

1. `DATABASE_URL`: your Neon connection string (Neon → Connect)
2. `DB_BACKUP_PASSPHRASE`: a long random password from your password manager. **Keep it there**: without it the backups can't be opened.

Then **Actions → Database backup → Run workflow**. Green ✅ = backed up.

### Practise a restore once

1. Neon → **Databases → New database** → copy its connection string → GitHub secret `DB_RESTORE_URL`
2. **Actions → Database restore → Run workflow** → type `RESTORE`
3. The summary shows every table: rows in the backup = rows now

Never paste these values into a chat, including with your AI.

Costs nothing: public repos run free; private repos get 2,000 minutes a month and a backup takes about one. More in [references/troubleshooting.md](references/troubleshooting.md).
