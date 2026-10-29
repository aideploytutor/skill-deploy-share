#!/usr/bin/env node
/**
 * ops-dashboard — one page (/ops) that shows how the site is doing: new users, revenue, payments,
 * emails and health checks for the last 14 days, read from the site's own database.
 *
 *   node apply.mjs --dir ./my-site             patch the project (safe to run twice)
 *   node apply.mjs ... --check                 show what would change, change nothing
 *   node apply.mjs ... --json                  machine-readable result
 *   node apply.mjs ... --no-git                skip the commit
 *
 * Needs app-foundation, db-connect and auth-login. No new tables, no new packages, no secrets,
 * no outside account: the owner sets OPS_ADMIN_EMAILS (plain text) in the host's variables.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = ["src/modules/ops/metrics.ts", "src/modules/ops/access.ts", "src/app/ops/page.tsx"];

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
const result = { ok: false, skill: "ops-dashboard", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };

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
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002), or use launch-kit." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  for (const need of ["db-connect", "auth-login"]) {
    if (!installed[need]) throw Object.assign(new Error(`${need} is not installed`), { code: 3, hint: `Install ${need} first: the dashboard reads the database and only the owner (signed in) can open it.` });
  }

  // 1. Our files (yours are kept if you edited them)
  for (const rel of NEW_FILES) {
    const content = fs.readFileSync(path.join(FILES, rel), "utf8");
    const to = path.join(dir, rel);
    if (!fs.existsSync(to)) write(dir, rel, content);
    else if (fs.readFileSync(to, "utf8") !== content) result.skipped.push(`${rel} (exists, kept yours)`);
  }

  // 2. The language switch the page links to (app-foundation homepages from launch-kit already have it)
  const langRoute = path.join(dir, "src/app/lang/route.ts");
  if (!fs.existsSync(langRoute)) {
    write(dir, "src/app/lang/route.ts", `import { NextResponse, type NextRequest } from "next/server";

/** ?to=en|zh&next=/path: remember the language in a cookie and go back. */
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") === "zh" ? "zh" : "en";
  const nextPath = req.nextUrl.searchParams.get("next") ?? "/";
  const safe = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const res = NextResponse.redirect(new URL(safe, req.url));
  res.cookies.set("lang", to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
`);
  }

  // 3. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/OPS_ADMIN_EMAILS/.test(env)) {
    write(dir, ".env.example", env.trimEnd() + `

# ops-dashboard (episode 015) — who can open /ops. Not secrets, but set them in the host's variables.
# OPS_ADMIN_EMAILS=you@example.com        (your sign-in email; several: a@x.com,b@y.com)
# OPS_TIMEZONE=America/Los_Angeles        (optional; days are counted in this time zone, default UTC)
# OPS_DASHBOARD_PUBLIC=true               (optional, demos only: anyone can see the numbers)
`);
  }

  // 4. Record the install
  if (installed["ops-dashboard"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "ops-dashboard": VERSION } }, null, 2) + "\n");
  }

  if (!installed["db-backup"]) result.warnings.push("db-backup is not installed: the Backup check will say 'Not set up'.");
  if (!installed["email-send"]) result.warnings.push("email-send is not installed: the email tile will stay at 0.");

  // 5. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add ops-dashboard: /ops with sign-ups, revenue, emails and health checks"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Host variables (plain text): OPS_ADMIN_EMAILS=<the email you sign in with>; optional OPS_TIMEZONE (e.g. America/Los_Angeles)",
    "Push → sign in with that email → open /ops",
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
  log(`✔ ops-dashboard ${VERSION}${opts.check ? " (check only)" : ""}`);
  for (const c of result.changed) log(`  + ${c}`);
  for (const s of result.skipped) log(`  = ${s}`);
  for (const w of result.warnings) log(`  ~ ${w}`);
  for (const m of result.manual) log(`  ! ${m}`);
  for (const n of result.next) log(`  → ${n}`);
}
