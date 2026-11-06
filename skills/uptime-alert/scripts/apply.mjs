#!/usr/bin/env node
/**
 * uptime-alert — know the site is down before your users do.
 * The checking is done by UptimeRobot (free: 50 monitors, every 5 minutes, email + phone push).
 * This script prepares the site for it:
 *   - /api/health answers {"status":"up"} (the monitor's keyword), 503 when the database is down,
 *     supports HEAD, never cached, and HEALTH_FORCE_DOWN=true fakes an outage to test the alert
 *   - src/modules/uptime/uptimerobot.ts reads the monitor (READ-ONLY key) so /ops shows uptime
 *
 *   node apply.mjs --dir ./my-site             patch the project (safe to run twice)
 *   node apply.mjs ... --check                 show what would change, change nothing
 *   node apply.mjs ... --json                  machine-readable result
 *   node apply.mjs ... --no-git                skip the commit
 *   node apply.mjs --verify https://my.site    check /api/health from here (status, keyword, no-cache)
 *
 * Needs app-foundation. No packages, no tables. Secrets: only UPTIMEROBOT_API_KEY (read-only), set on the host.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const HEALTH = "src/app/api/health/route.ts";
const MODULE = "src/modules/uptime/uptimerobot.ts";
const FOUNDATION_HEALTH_MARK = "Used by uptime monitors and by skills to check the app is up.";

const opts = { json: false, check: false, git: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--verify") opts.verify = argv[++i];
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}
const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));

if (opts.verify) {
  const url = opts.verify.replace(/\/$/, "") + "/api/health";
  const r = { url, ok: false };
  try {
    const res = await fetch(url, { headers: { "user-agent": "uptime-alert-verify" } });
    const text = await res.text();
    r.status = res.status;
    r.keyword = text.includes('"status":"up"');
    r.noStore = (res.headers.get("cache-control") || "").includes("no-store");
    r.ok = res.status === 200 && r.keyword && r.noStore;
    if (text.includes("HEALTH_FORCE_DOWN")) r.hint = "HEALTH_FORCE_DOWN is on: delete it after the alert test";
  } catch (e) { r.error = e.message; }
  if (opts.json) console.log(JSON.stringify(r, null, 2));
  else log(`${r.ok ? "✔" : "✖"} ${url} → ${r.status ?? r.error} · keyword ${r.keyword ? "found" : "missing"} · ${r.noStore ? "not cached" : "cache header missing"}${r.hint ? `\n  ! ${r.hint}` : ""}`);
  process.exit(r.ok ? 0 : 1);
}

const result = { ok: false, skill: "uptime-alert", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
function write(dir, rel, content) {
  if (!opts.check) {
    const to = path.join(dir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir (or --verify <url>) is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002), or use launch-kit." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};

  // 1. Health check: replace the foundation's version; keep a customised one and say what to add.
  const want = fs.readFileSync(path.join(FILES, HEALTH), "utf8");
  const hp = path.join(dir, HEALTH);
  const cur = fs.existsSync(hp) ? fs.readFileSync(hp, "utf8") : "";
  if (cur !== want) {
    if (!cur || cur.includes(FOUNDATION_HEALTH_MARK)) write(dir, HEALTH, want);
    else if (!cur.includes('status: up ? "up" : "down"')) {
      result.skipped.push(`${HEALTH} (yours, kept)`);
      result.manual.push(`Your /api/health was customised. Make it return {"status":"up"} when healthy and 503 when not, with cache-control: no-store. Reference: ${path.join(FILES, HEALTH)}`);
    }
  }

  // 2. Monitor reader (ops-dashboard ships the same file)
  const mod = fs.readFileSync(path.join(FILES, MODULE), "utf8");
  const mp = path.join(dir, MODULE);
  if (!fs.existsSync(mp)) write(dir, MODULE, mod);
  else if (fs.readFileSync(mp, "utf8") !== mod) result.skipped.push(`${MODULE} (exists, kept yours)`);

  // 3. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/UPTIMEROBOT_API_KEY/.test(env)) {
    write(dir, ".env.example", env.trimEnd() + `

# uptime-alert (episode 016) — the monitor itself lives on uptimerobot.com (free, 5-minute checks).
# UPTIMEROBOT_API_KEY=...                 (secret, READ-ONLY key: UptimeRobot → Integrations & API; lets /ops show uptime)
# STATUS_PAGE_URL=https://stats.uptimerobot.com/...   (optional, your public status page; not a secret)
# UPTIME_MONITOR_MATCH=shop.example.com   (optional, which monitor to show when you have several)
# HEALTH_FORCE_DOWN=true                  (alert test only: /api/health answers "down"; delete it afterwards)
`);
  }

  // 4. Record the install
  if (installed["uptime-alert"] !== VERSION) write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "uptime-alert": VERSION } }, null, 2) + "\n");
  if (!installed["ops-dashboard"]) result.warnings.push("ops-dashboard is not installed: alerts still work, but there is no /ops page to show uptime on.");

  // 5. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add uptime-alert: health keyword, alert test switch, uptime on /ops"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Push, then: node <skill-dir>/scripts/apply.mjs --verify https://<your-domain>",
    "Owner (phone OK): sign up at uptimerobot.com → New monitor → Keyword → https://<domain>/api/health, keyword \"status\":\"up\", alert when keyword does NOT exist, 5 min",
    "Owner: install the UptimeRobot app for push alerts; create the free status page; optional read-only API key → host secret UPTIMEROBOT_API_KEY",
    "Alert test: host variable HEALTH_FORCE_DOWN=true → wait ≤ 5 min for the alert → delete it → wait for the 'up' alert",
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
  log(`✔ uptime-alert ${VERSION}${opts.check ? " (check only)" : ""}`);
  for (const c of result.changed) log(`  + ${c}`);
  for (const s of result.skipped) log(`  = ${s}`);
  for (const w of result.warnings) log(`  ~ ${w}`);
  for (const m of result.manual) log(`  ! ${m}`);
  for (const n of result.next) log(`  → ${n}`);
}
