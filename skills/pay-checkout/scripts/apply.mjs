#!/usr/bin/env node
/**
 * pay-checkout — take payments with Creem (merchant of record; pays out to mainland China banks too).
 *
 *   node apply.mjs --dir ./my-shop            patch the project (safe to run twice)
 *   node apply.mjs --dir ./my-shop --check    show what would change, change nothing
 *   node apply.mjs ... --json                 machine-readable result
 *   node apply.mjs ... --no-git --no-generate skip the commit / the migration step
 *
 * Adds the pay_payments table, src/lib/pay.ts, /pricing, /pay/success and /api/pay/webhook,
 * documents CREEM_* variables in .env.example, records the install and commits. Then generates
 * the database migration if dependencies are installed. No new npm packages (plain fetch + Web Crypto),
 * so it runs on Vercel and Cloudflare Workers. It never touches secrets: the owner pastes the
 * Creem API key and webhook secret into the host's settings.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = [
  "src/db/schema/pay.ts",
  "src/lib/pay.ts",
  "src/app/api/pay/webhook/route.ts",
  "src/app/pricing/page.tsx",
  "src/app/pay/success/page.tsx",
];
// Earlier versions of our own files: replaced on upgrade only if the owner never edited them.
const PREVIOUS = {};

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
const result = { ok: false, skill: "pay-checkout", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function write(dir, rel, content) {
  if (!opts.check) {
    const to = path.join(dir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["app-foundation"]) throw Object.assign(new Error("stack.json does not list app-foundation"), { code: 3 });
  if (!installed["db-connect"]) throw Object.assign(new Error("db-connect is not installed — payments are recorded in the database"), { code: 3, hint: "Install db-connect first (episode 003)." });
  if (!installed["auth-login"]) throw Object.assign(new Error("auth-login is not installed — every payment belongs to a signed-in user"), { code: 3, hint: "Install auth-login first (episode 006)." });
  if (!installed["deploy-cloudflare"]) {
    result.warnings.push("Vercel Hobby forbids commercial use. Test mode is fine, but before taking real money move to Cloudflare (deploy-cloudflare, episode 009) or Vercel Pro.");
  }

  // 1. Our files (never overwrite something the owner changed)
  for (const rel of NEW_FILES) {
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    const to = path.join(dir, rel);
    if (!fs.existsSync(to)) write(dir, rel, src);
    else if (fs.readFileSync(to, "utf8") === src) continue;
    else if ((PREVIOUS[rel] || []).includes(sha(to))) write(dir, rel, src);
    else result.skipped.push(`${rel} (exists, kept yours)`);
  }

  // 2. Schema index
  const idxPath = path.join(dir, "src/db/schema/index.ts");
  const idx = fs.readFileSync(idxPath, "utf8");
  if (!/from\s+["']\.\/pay["']/.test(idx)) write(dir, "src/db/schema/index.ts", idx.trimEnd() + '\nexport * from "./pay";\n');

  // 3. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/CREEM_API_KEY/.test(env)) {
    write(dir, ".env.example", env.trimEnd() +
      "\n\n# pay-checkout (episode 010) — set these in your host's settings, never in code or chat.\n" +
      "# CREEM_API_KEY=creem_test_...      (secret: Creem → Developers → API key; test keys move no real money)\n" +
      "# CREEM_WEBHOOK_SECRET=...          (secret: Creem → Developers → Webhooks, for https://<domain>/api/pay/webhook)\n" +
      "# CREEM_PRODUCT_ID=prod_...         (the product /pricing sells)\n");
  }

  // 4. Record the install
  if (installed["pay-checkout"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "pay-checkout": VERSION } }, null, 2) + "\n");
  }

  // 5. Migration for pay_payments
  const journal = path.join(dir, "drizzle/meta/_journal.json");
  const drizzleDir = path.join(dir, "drizzle");
  const hasMigration = fs.existsSync(drizzleDir) &&
    fs.readdirSync(drizzleDir).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(drizzleDir, f), "utf8").includes('"pay_payments"'));
  if (!hasMigration) {
    const kit = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
    if (!opts.check && opts.generate && fs.existsSync(kit) && fs.existsSync(journal)) {
      const g = spawnSync(kit, ["generate", "--name", "pay_checkout"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
      if (g.status === 0) result.changed.push("drizzle/ (pay_checkout migration)");
      else result.manual.push(`Generate the migration: npm install && npm run db:generate -- --name pay_checkout\n${g.stderr || g.stdout}`);
    } else {
      result.manual.push("Generate the migration: npm install, then npm run db:generate -- --name pay_checkout, and commit the drizzle/ folder");
    }
  }

  // 6. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add pay-checkout: Creem checkout, /pricing, webhook"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Owner: creem.io → sign up → Test Mode on → Products → create a one-time product → copy its prod_ ID (not a secret)",
    "Owner: Creem → Developers → API key (test) → paste into the host as secret CREEM_API_KEY",
    "Owner: Creem → Developers → Webhooks → add https://<domain>/api/pay/webhook → paste its secret as CREEM_WEBHOOK_SECRET",
    "Set CREEM_PRODUCT_ID (plain text) → redeploy → /pricing → pay with test card 4242 4242 4242 4242",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  for (const s of result.skipped) log("Kept:", s);
  for (const w of result.warnings) log("⚠", w);
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
