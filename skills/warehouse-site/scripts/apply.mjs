#!/usr/bin/env node
/**
 * warehouse-site — a US warehouse (3PL / 海外仓) website that brings in sellers:
 * a branded homepage with services and prices, a live quote calculator, an inquiry form that
 * emails the owner and the seller, and an owner-only inquiry list.
 *
 *   node apply.mjs --dir ./my-warehouse        patch the project (safe to run twice)
 *   node apply.mjs ... --check                 show what would change, change nothing
 *   node apply.mjs ... --json                  machine-readable result
 *   node apply.mjs ... --no-git --no-generate  skip the commit / the migration step
 *
 * Needs app-foundation, db-connect, email-send and auth-login. No new packages, no secrets:
 * the owner sets WAREHOUSE_ADMIN_EMAILS (and optionally WAREHOUSE_INBOX_EMAIL), both plain text.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = [
  "src/db/schema/warehouse.ts",
  "src/modules/warehouse/config.ts",
  "src/modules/warehouse/quote.ts",
  "src/modules/warehouse/inquiries.ts",
  "src/modules/warehouse/ui.tsx",
  "src/app/quote/page.tsx",
  "src/app/quote/quote-form.tsx",
  "src/app/contact/page.tsx",
  "src/app/admin/inquiries/page.tsx",
];
const HOME = "src/app/page.tsx";
const FOUNDATION_HOME_MARK = "Foundation ready · app-foundation";

const opts = { json: false, check: false, git: true, generate: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--no-generate") opts.generate = false;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}

const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const result = { ok: false, skill: "warehouse-site", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };

function write(dir, rel, content) {
  if (!opts.check) {
    const to = path.join(dir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}
function place(dir, rel, content) {
  const to = path.join(dir, rel);
  if (!fs.existsSync(to)) return write(dir, rel, content);
  if (fs.readFileSync(to, "utf8") === content) return;
  result.skipped.push(`${rel} (exists, kept yours)`);
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002), or use launch-kit." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  for (const need of ["db-connect", "email-send", "auth-login"]) {
    if (!installed[need]) throw Object.assign(new Error(`${need} is not installed`), { code: 3, hint: `Install ${need} first: inquiries are stored in the database, emailed, and the inquiry list needs sign-in.` });
  }

  // 1. Our files
  for (const rel of NEW_FILES) place(dir, rel, fs.readFileSync(path.join(FILES, rel), "utf8"));

  // 2. The homepage becomes the warehouse's front page (only if it's still the foundation's placeholder)
  const homePath = path.join(dir, HOME);
  const home = fs.readFileSync(path.join(FILES, HOME), "utf8");
  const cur = fs.existsSync(homePath) ? fs.readFileSync(homePath, "utf8") : "";
  if (!cur || cur.includes(FOUNDATION_HOME_MARK)) { if (cur !== home) write(dir, HOME, home); }
  else if (cur !== home) {
    result.skipped.push(`${HOME} (yours, kept)`);
    result.manual.push(`Your homepage was edited, so it wasn't replaced. The warehouse front page is in ${path.join(FILES, HOME)}: copy it in, or link to /quote and /contact from yours.`);
  }

  // 3. Schema index
  const idxPath = path.join(dir, "src/db/schema/index.ts");
  const idx = fs.readFileSync(idxPath, "utf8");
  if (!/from\s+["']\.\/warehouse["']/.test(idx)) write(dir, "src/db/schema/index.ts", idx.trimEnd() + '\nexport * from "./warehouse";\n');

  // 4. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/WAREHOUSE_ADMIN_EMAILS/.test(env)) {
    write(dir, ".env.example", env.trimEnd() + "\n\n# warehouse-site (episode 015)\n# WAREHOUSE_ADMIN_EMAILS=you@example.com        (who can open /admin/inquiries; comma-separated; not a secret)\n# WAREHOUSE_INBOX_EMAIL=sales@example.com       (where new inquiries are emailed; defaults to the first admin)\n");
  }

  // 5. Record the install
  if (installed["warehouse-site"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "warehouse-site": VERSION } }, null, 2) + "\n");
  }

  // 6. Migration
  const drizzleDir = path.join(dir, "drizzle");
  const hasMigration = fs.existsSync(drizzleDir) &&
    fs.readdirSync(drizzleDir).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(drizzleDir, f), "utf8").includes('"warehouse_inquiries"'));
  if (!hasMigration) {
    const kit = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
    if (!opts.check && opts.generate && fs.existsSync(kit)) {
      const g = spawnSync(kit, ["generate", "--name", "warehouse"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
      if (g.status === 0) result.changed.push("drizzle/ (warehouse migration)");
      else result.manual.push(`Generate the migration: npm run db:generate -- --name warehouse\n${g.stderr || g.stdout}`);
    } else {
      result.manual.push("Generate the migration: npm install, then npm run db:generate -- --name warehouse, and commit the drizzle/ folder");
    }
  }

  // 7. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add warehouse-site: front page, quote calculator, inquiries"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Edit src/modules/warehouse/config.ts: name, services, location, WeChat, and YOUR prices (the examples are placeholders)",
    "Host variables (plain text): WAREHOUSE_ADMIN_EMAILS=<owner email>; optional WAREHOUSE_INBOX_EMAIL",
    "Push → open / , /quote , /contact → send a test inquiry → check the owner's inbox and /admin/inquiries (sign in with the admin email)",
  ];
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.error(`✖ ${e.message}${e.hint ? `\n  ${e.hint}` : ""}`);
  process.exit(e.code || 1);
}

if (opts.json) console.log(JSON.stringify(result, null, 2));
else {
  log(`✔ warehouse-site ${VERSION}${opts.check ? " (check only)" : ""}`);
  for (const c of result.changed) log(`  + ${c}`);
  for (const s of result.skipped) log(`  = ${s}`);
  for (const m of result.manual) log(`  ! ${m}`);
  for (const n of result.next) log(`  → ${n}`);
}
