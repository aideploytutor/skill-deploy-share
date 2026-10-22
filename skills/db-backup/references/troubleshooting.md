# db-backup troubleshooting

| What you see | Why | Fix |
|---|---|---|
| "Missing secret DATABASE_URL" | Secret not added, or added as a *variable* or *environment* secret | Settings → Secrets and variables → Actions → **Repository secrets** |
| "DB_BACKUP_PASSPHRASE is missing or shorter than 16 characters" | Not added, or too short | Generate 16+ characters in a password manager |
| Backup fails at `psql`/`pg_dump` with "password authentication failed" | Wrong or rotated database password | Copy the connection string from Neon again |
| `could not translate host name` / timeout | Typo in the URL, or the database is on a private network | Copy it again; GitHub must be able to reach it over the internet |
| "The backup has no table data" | `DATABASE_URL` points at an empty database | Use the production connection string |
| No backups for weeks, workflow shows "disabled" | GitHub turns off scheduled workflows in **public** repos after 60 days without commits | Actions → Database backup → **Enable workflow** (any commit also keeps it alive) |
| Artifact storage full (private repo) | Private repos share 500 MB for artifacts and packages | Lower the keep period: `apply.mjs --keep 7`, or delete old artifacts |
| Restore: "No successful backup found" | No green backup run yet, or it's older than the keep period | Run Database backup first |
| Restore: "Couldn't decrypt the backup" | `DB_BACKUP_PASSPHRASE` changed since that backup was made | Put the old passphrase back (from your password manager), restore, then change it |
| Restore: "DB_RESTORE_URL is your production database" | Safety stop | Restore into a new database. Only type `RESTORE PRODUCTION` if you mean it |
| Restore fails halfway | Anything (permissions, version) | Nothing changed: it runs in one transaction. Read the error in the log |
| "Rows now" differs a little with ⚠️ | The site was used while the backup ran (counts are taken just before the copy) | Expected for busy tables; a large gap means check the restore log |
