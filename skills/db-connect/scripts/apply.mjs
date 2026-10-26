#!/usr/bin/env node
/**
 * db-connect — prepare an app-foundation project to use a Postgres database.
 *
 *   node apply.mjs --dir ./my-shop          patch the project (safe to run twice)
 *   node apply.mjs --dir ./my-shop --check  report what would change, change nothing
 *   node apply.mjs ... --json               machine-readable result
 *
 * It never touches secrets: DATABASE_URL is pasted by the owner into the host's settings
 * (or typed into .env.local by the owner), not by this script.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.1.1";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const FOUNDATION_TEMPLATE = path.join(here, "..", "..", "app-foundation", "template");

// Files db-connect replaces on install or upgrade, with the hashes of every earlier version
// we shipped (app-foundation originals and older db-connect copies). Replaced only if untouched.
const UPGRADES = {
  "src/app/api/health/route.ts": [
    "ac02411224cccfac97f22f56a22d63905468f82e6c7ae2563a27ae63e514f5b1", // app-foundation
    "23928009ef8e9f24043b97c593236662daf015770dc468e9394674ebd6ca766f", // db-connect 1.0.0–1.1.0
  ],
  "src/app/status/page.tsx": [
    "35ff613c59447a8372c9595e815c09b746b531741e209bc1395ecc0cf69623b3", // app-foundation 1.0.0–1.0.2
    "0c16fd35440c97fb342f501c6d47d6252ae03ffc57f7141bcbc6ca4fd1339e68", // app-foundation 1.1.0 (English)
    "555e0406fa15f3bd49015b8c09b154e1bf153da474f293b1ed6baf13b5fd571d", // db-connect 1.0.0
  ],
  "src/app/db-test/page.tsx": ["2ac1bfc87e4f2ce649abda3074ff03c67e303da20bd2cb982799a4238da418d4"], // db-connect 1.0.0
};
const NEW_FILES = ["scripts/db-migrate.mjs"];

const opts = { json: false, check: false, git: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}

const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const result = { ok: false, skill: "db-connect", version: VERSION, changed: [], skipped: [], manual: [] };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function write(dir, rel, content) {
  const to = path.join(dir, rel);
  if (!opts.check) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) {
    throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), {
      code: 3, hint: "Install app-foundation first (episode 002), or point --dir at the project folder.",
    });
  }
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  if (!stack.installed?.["app-foundation"]) {
    throw Object.assign(new Error("stack.json does not list app-foundation"), { code: 3 });
  }

  // 1. New files (never overwrite something the owner already has)
  for (const rel of NEW_FILES) {
    const to = path.join(dir, rel);
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    if (fs.existsSync(to) && fs.readFileSync(to, "utf8") !== src) { result.skipped.push(`${rel} (exists, kept yours)`); continue; }
    if (!fs.existsSync(to)) write(dir, rel, src);
  }

  // 2. Our files and upgraded foundation files: only when unchanged since a version we shipped
  for (const [rel, known] of Object.entries(UPGRADES)) {
    const to = path.join(dir, rel);
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    if (!fs.existsSync(to)) { write(dir, rel, src); continue; }
    if (fs.readFileSync(to, "utf8") === src) continue; // already applied
    if (known.includes(sha(to))) write(dir, rel, src);
    else result.manual.push(`${rel}: you changed this file, so it was not replaced. Merge in the database check from ${path.join(FILES, rel)}`);
  }

  // 3. package.json scripts
  const pkgPath = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const scripts = (pkg.scripts ??= {});
  let pkgChanged = false;
  if (!String(scripts.build || "").includes("db-migrate")) {
    scripts.build = `node scripts/db-migrate.mjs && ${scripts.build || "next build"}`;
    pkgChanged = true;
  }
  if (scripts["db:migrate"] !== "node scripts/db-migrate.mjs") {
    scripts["db:migrate"] = "node scripts/db-migrate.mjs";
    pkgChanged = true;
  }
  if (pkgChanged) write(dir, "package.json", JSON.stringify(pkg, null, 2) + "\n");

  // 4. drizzle.config.ts: migrations use the direct connection when available
  const dcPath = path.join(dir, "drizzle.config.ts");
  if (fs.existsSync(dcPath)) {
    const dc = fs.readFileSync(dcPath, "utf8");
    if (!dc.includes("DATABASE_URL_UNPOOLED")) {
      const next = dc.replace('process.env.DATABASE_URL ?? ""', 'process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ""');
      if (next !== dc) write(dir, "drizzle.config.ts", next);
      else result.manual.push("drizzle.config.ts: set dbCredentials.url to DATABASE_URL_UNPOOLED ?? DATABASE_URL");
    }
  }

  // 5. Migrations: projects made with app-foundation 1.0.0 have none yet — add the core_events one
  const journal = path.join(dir, "drizzle", "meta", "_journal.json");
  if (!fs.existsSync(journal)) {
    const schemaIndex = fs.readFileSync(path.join(dir, "src", "db", "schema", "index.ts"), "utf8");
    const onlyCore = schemaIndex.split("\n").filter((l) => /^\s*export\s/.test(l)).every((l) => l.includes('"./core"'));
    if (onlyCore) {
      for (const rel of ["drizzle/0000_init.sql", "drizzle/meta/0000_snapshot.json", "drizzle/meta/_journal.json"]) {
        write(dir, rel, fs.readFileSync(path.join(FOUNDATION_TEMPLATE, rel), "utf8"));
      }
      if (!opts.check) fs.rmSync(path.join(dir, "drizzle", ".gitkeep"), { force: true });
    } else {
      result.manual.push("No migrations yet and the schema has extra tables: run `npm run db:generate`, then commit the drizzle/ folder");
    }
  }

  // 6. .env.example documents the variables
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/^\s*#?\s*DATABASE_URL_UNPOOLED=/m.test(env)) {
    // drop the placeholder lines app-foundation wrote, then add the full block
    const kept = env.split(/\r?\n/).filter((l) => !/^#\s*db-connect\b/.test(l) && !/^#\s*DATABASE_URL=/.test(l)).join("\n");
    const block = kept.trimEnd() +
      "\n\n# db-connect (episode 003) — Neon → Connect → copy; paste into the host's settings as a Secret (runtime AND build).\n" +
      "# For local development, put the same value in .env.local (never commit it).\n" +
      "# DATABASE_URL=postgres://...            (pooled, used by the app)\n" +
      "# DATABASE_URL_UNPOOLED=postgres://...   (direct, used for migrations)\n";
    write(dir, ".env.example", block);
  }

  // 7. Record the install
  if (stack.installed["db-connect"] !== VERSION) {
    stack.installed["db-connect"] = VERSION;
    write(dir, "stack.json", JSON.stringify(stack, null, 2) + "\n");
  }

  // 8. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add db-connect: migrations on build, DB health check, /db-test"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Owner: neon.com → New project (Free) → Connect → copy the connection string → paste as DATABASE_URL (Secret) into the host: runtime variables and, on Cloudflare, Builds → Variables too",
    "Push (or retry the build) so the build picks up DATABASE_URL and creates the tables",
    "Open /api/health (database.status = connected) and /db-test",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  if (result.skipped.length) log("Kept:", result.skipped.join("; "));
  for (const m of result.manual) log("⚠ Needs a hand:", m);
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  console.error(`✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  process.exitCode = e.code || 1;
} finally {
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
