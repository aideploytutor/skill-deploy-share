#!/usr/bin/env node
/**
 * db-backup — back up the Postgres database every day, encrypted, with GitHub Actions (free).
 *
 *   node apply.mjs --dir ./my-shop               add the backup + restore workflows (safe to run twice)
 *   node apply.mjs --dir ./my-shop --hour 19     run the daily backup at 19:17 UTC instead of 03:17
 *   node apply.mjs --dir ./my-shop --keep 14     keep each backup 14 days instead of 30 (1-90)
 *   node apply.mjs ... --check                   show what would change, change nothing
 *   node apply.mjs ... --json                    machine-readable result
 *   node apply.mjs ... --no-git                  skip the commit
 *
 * Adds .github/workflows/db-backup.yml (daily pg_dump → AES-256 encrypted → kept as a GitHub artifact,
 * checked readable before it counts) and db-restore.yml (puts a backup into a database you choose,
 * all or nothing, refuses production unless told explicitly). It never touches secrets: the owner adds
 * DATABASE_URL, DB_BACKUP_PASSPHRASE and DB_RESTORE_URL in GitHub → Settings → Secrets and variables → Actions.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const BACKUP = ".github/workflows/db-backup.yml";
const RESTORE = ".github/workflows/db-restore.yml";
// Earlier versions of our own files: replaced on upgrade only if the owner never edited them.
const PREVIOUS = {};

const opts = { json: false, check: false, git: true, hour: 3, keep: 30 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--hour") opts.hour = Number(argv[++i]);
  else if (a === "--keep") opts.keep = Number(argv[++i]);
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}

const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const result = { ok: false, skill: "db-backup", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function write(dir, rel, content) {
  if (!opts.check) {
    const to = path.join(dir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}
/** Our file, unless the owner changed theirs. */
function place(dir, rel, content) {
  const to = path.join(dir, rel);
  if (!fs.existsSync(to)) return write(dir, rel, content);
  const cur = fs.readFileSync(to, "utf8");
  if (cur === content) return;
  if ((PREVIOUS[rel] || []).includes(sha(cur))) return write(dir, rel, content);
  result.skipped.push(`${rel} (exists, kept yours)`);
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  if (!Number.isInteger(opts.hour) || opts.hour < 0 || opts.hour > 23) throw Object.assign(new Error("--hour must be 0-23 (UTC)"), { code: 64 });
  if (!Number.isInteger(opts.keep) || opts.keep < 1 || opts.keep > 90) throw Object.assign(new Error("--keep must be 1-90 days"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["db-connect"]) throw Object.assign(new Error("db-connect is not installed — there is no database to back up yet"), { code: 3, hint: "Install db-connect first (episode 003)." });

  // 1. Workflows
  let backup = fs.readFileSync(path.join(FILES, BACKUP), "utf8");
  backup = backup.replace('"17 3 * * *" # every day at 03:17 UTC', `"17 ${opts.hour} * * *" # every day at ${String(opts.hour).padStart(2, "0")}:17 UTC`);
  backup = backup.replace("KEEP_DAYS: 30", `KEEP_DAYS: ${opts.keep}`);
  place(dir, BACKUP, backup);
  place(dir, RESTORE, fs.readFileSync(path.join(FILES, RESTORE), "utf8"));

  // 2. Document the secrets next to the others (they live in GitHub, not in the host)
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/DB_BACKUP_PASSPHRASE/.test(env)) {
    write(dir, ".env.example", env.trimEnd() +
      "\n\n# db-backup (episode 011) — GitHub → repo → Settings → Secrets and variables → Actions, never in code or chat.\n" +
      "# DATABASE_URL=postgres://...        (secret: the production database, same as the host's)\n" +
      "# DB_BACKUP_PASSPHRASE=...           (secret: 16+ random characters; also keep it in your password manager)\n" +
      "# DB_RESTORE_URL=postgres://...      (secret: an EMPTY database to restore into, e.g. a new Neon database)\n");
  }

  // 3. Record the install
  if (installed["db-backup"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "db-backup": VERSION } }, null, 2) + "\n");
  }

  // 4. Where will it run?
  const remote = spawnSync("git", ["remote", "get-url", "origin"], { cwd: dir, encoding: "utf8" });
  const url = remote.status === 0 ? remote.stdout.trim() : "";
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (!m) result.warnings.push("No GitHub remote found. The backups run on GitHub Actions: push this project to GitHub first (episode 001).");
  else result.repo = `${m[1]}/${m[2]}`;

  // 5. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add db-backup: daily encrypted database backup + restore workflow"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  const secrets = result.repo ? `https://github.com/${result.repo}/settings/secrets/actions` : "GitHub → repo → Settings → Secrets and variables → Actions";
  const actions = result.repo ? `https://github.com/${result.repo}/actions` : "GitHub → repo → Actions";
  result.ok = true;
  result.next = [
    "Push (git push) so GitHub sees the workflows",
    `Owner: ${secrets} → New repository secret DATABASE_URL (Neon → Connect → copy the connection string)`,
    "Owner: New repository secret DB_BACKUP_PASSPHRASE (16+ random characters from a password manager; save it there too)",
    `Run once now: ${actions} → Database backup → Run workflow → green ✅, summary lists every table`,
    "Restore drill: create an empty database (Neon → Databases → New database), save its URL as secret DB_RESTORE_URL, then Actions → Database restore → Run workflow → type RESTORE",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  for (const s of result.skipped) log("Kept:", s);
  for (const w of result.warnings) log("⚠", w);
  for (const n of result.next) log("→", n);
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  console.error(`✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  process.exitCode = e.code || 1;
} finally {
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
