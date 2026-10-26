#!/usr/bin/env node
/**
 * launch-kit — from an empty folder to a site that takes money, on Cloudflare only.
 *
 *   node launch.mjs build  --dir ./my-shop --name "My Shop" --domain shop.example.com
 *                          [--sending-domain mail.example.com] [--github private|public|none]
 *                          [--no-install]
 *       Runs every skill in order (app-foundation → db-connect → deploy-cloudflare → email-send →
 *       auth-login → env-secrets → pay-checkout → pay-webhook → pay-subscription → db-backup),
 *       installs dependencies, generates one database migration, creates the GitHub repo and
 *       writes LAUNCH.md: the owner's checklist with this project's exact names and URLs.
 *       Safe to run again: finished steps are skipped.
 *
 *   node launch.mjs status --dir ./my-shop
 *       What's installed, what the owner still has to do.
 *
 *   node launch.mjs doctor --url https://shop.example.com [--sending-domain mail.example.com]
 *       Checks the live site end to end and says what to fix: Cloudflare is serving it, database,
 *       sign-in, email DNS, payments, subscription, webhook, payment catch-up.
 *
 *   Add --json to any command for machine-readable output.
 *
 * Never reads or writes secrets. The owner pastes them into Cloudflare / GitHub; LAUNCH.md says where.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.resolve(here, "..", "..");
const cmd = process.argv[2];
const opts = { json: false, install: true, github: "private" };
const argv = process.argv.slice(3);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--name") opts.name = argv[++i];
  else if (a === "--domain") opts.domain = clean(argv[++i]);
  else if (a === "--sending-domain") opts.sending = clean(argv[++i]);
  else if (a === "--url") opts.url = (argv[++i] || "").replace(/\/$/, "");
  else if (a === "--github") opts.github = argv[++i];
  else if (a === "--no-install") opts.install = false;
  else if (a === "--json") opts.json = true;
  else if (a === "--help" || a === "-h") help(0);
  else { console.error(`✖ unknown option ${a}`); help(64); }
}
function clean(d) { return (d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""); }
function help(code) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(code); }
const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const apex = (d) => d.split(".").slice(-2).join(".");

// ---------------------------------------------------------------------------------------------
// build

const STEPS = [
  { skill: "app-foundation", label: "Product foundation (Next.js + Postgres-ready)", run: (d) => ["app-foundation/scripts/create.mjs", "--dir", d, "--name", opts.name, "--no-install"] },
  { skill: "db-connect", label: "Database connection + migrations on every build", run: (d) => ["db-connect/scripts/apply.mjs", "--dir", d] },
  { skill: "deploy-cloudflare", label: "Runs on Cloudflare Workers (free, commercial use allowed)", run: (d) => ["deploy-cloudflare/scripts/apply.mjs", "--dir", d] },
  { skill: "email-send", label: "Email from your own domain (Resend)", run: (d) => ["email-send/scripts/apply.mjs", "--dir", d, "--sending-domain", opts.sending] },
  { skill: "auth-login", label: "Sign-in with an email code (Google optional)", run: (d) => ["auth-login/scripts/apply.mjs", "--dir", d, "--no-generate"] },
  { skill: "env-secrets", label: "Secret-key guard before every commit", run: (d) => ["env-secrets/scripts/apply.mjs", "--dir", d], text: true },
  { skill: "pay-checkout", label: "Buy button (Creem, test mode first)", run: (d) => ["pay-checkout/scripts/apply.mjs", "--dir", d, "--no-generate"] },
  { skill: "pay-webhook", label: "Payments handled automatically + hourly catch-up", run: (d) => ["pay-webhook/scripts/apply.mjs", "--dir", d, "--url", `https://${opts.domain}`, "--no-generate"] },
  { skill: "pay-subscription", label: "Monthly subscriptions", run: (d) => ["pay-subscription/scripts/apply.mjs", "--dir", d, "--no-generate"] },
  { skill: "db-backup", label: "Daily encrypted database backup", run: (d) => ["db-backup/scripts/apply.mjs", "--dir", d] },
];

function readStack(dir) {
  const p = path.join(dir, "stack.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}
function writeStack(dir, patch) {
  const p = path.join(dir, "stack.json");
  const s = JSON.parse(fs.readFileSync(p, "utf8"));
  fs.writeFileSync(p, JSON.stringify({ ...s, ...patch }, null, 2) + "\n");
}
function sh(command, args, cwd) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}
function has(command) {
  return spawnSync(command, ["--version"], { encoding: "utf8", shell: process.platform === "win32" }).status === 0;
}

function build() {
  const result = { ok: false, command: "build", version: VERSION, steps: [], manual: [], warnings: [] };
  if (!opts.dir || !opts.name || !opts.domain) throw Object.assign(new Error("--dir, --name and --domain are required"), { code: 64 });
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(opts.domain)) throw Object.assign(new Error(`--domain looks wrong: ${opts.domain}`), { code: 64 });
  opts.sending ||= `mail.${apex(opts.domain)}`;
  const dir = path.resolve(opts.dir);

  for (const step of STEPS) {
    const stack = readStack(dir);
    if (stack?.installed?.[step.skill]) {
      result.steps.push({ skill: step.skill, status: "already done" });
      continue;
    }
    const [script, ...args] = step.run(dir);
    log(`→ ${step.label} (${step.skill})`);
    const r = spawnSync(process.execPath, [path.join(SKILLS, script), ...args, ...(step.text ? [] : ["--json"])], { encoding: "utf8" });
    let out = {};
    try { out = JSON.parse(r.stdout || "{}"); } catch { /* script printed text */ }
    if (r.status !== 0 || out.ok === false) {
      result.steps.push({ skill: step.skill, status: "failed", error: out.error || (r.stderr || "").trim().slice(-400) });
      result.error = `${step.skill} failed: ${out.error || "see output"}`;
      if (out.hint) result.hint = out.hint;
      return result;
    }
    result.steps.push({ skill: step.skill, status: "done" });
    for (const w of out.warnings || []) if (!/vercel|GitHub remote|No domain recorded/i.test(w)) result.warnings.push(`${step.skill}: ${w}`);
  }

  writeStack(dir, { domain: opts.domain, email: { ...(readStack(dir).email || {}), domain: opts.sending, provider: "resend" }, launch: { version: VERSION, siteUrl: `https://${opts.domain}` } });

  // Dependencies + one migration for every table the skills added
  const hasMigration = () => fs.readdirSync(path.join(dir, "drizzle")).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(dir, "drizzle", f), "utf8").includes('"pay_subscriptions"'));
  if (opts.install && has("npm")) {
    log("→ Installing dependencies (npm install)…");
    const i = sh("npm", ["install", "--no-audit", "--no-fund"], dir);
    if (!i.ok) result.manual.push(`npm install failed:\n${i.out.slice(-600)}`);
    else if (!hasMigration()) {
      log("→ Generating the database migration…");
      const g = sh("npm", ["run", "db:generate", "--", "--name", "launch"], dir);
      if (!g.ok) result.manual.push(`Generate the migration: npm run db:generate -- --name launch\n${g.out.slice(-600)}`);
    }
  } else if (!hasMigration()) {
    result.manual.push("Install and generate the migration: npm install && npm run db:generate -- --name launch, then commit drizzle/");
  }

  // LAUNCH.md: the owner's checklist with this project's names
  const stack = readStack(dir);
  const worker = readWorkerName(dir) || stack.slug || path.basename(dir);
  fs.writeFileSync(path.join(dir, "LAUNCH.md"), launchDoc({ name: opts.name, domain: opts.domain, sending: opts.sending, worker, repo: null }));
  sh("git", ["add", "-A"], dir);
  sh("git", ["commit", "-q", "-m", "launch-kit: database migration and launch checklist"], dir);

  // GitHub repo
  if (opts.github !== "none") {
    const remote = sh("git", ["remote", "get-url", "origin"], dir);
    if (remote.ok) result.repo = remote.out;
    else if (has("gh") && sh("gh", ["auth", "status"], dir).ok) {
      log("→ Creating the GitHub repo…");
      const c = sh("gh", ["repo", "create", worker, `--${opts.github === "public" ? "public" : "private"}`, "--source", dir, "--push"], dir);
      if (c.ok) result.repo = sh("git", ["remote", "get-url", "origin"], dir).out;
      else result.manual.push(`Create the GitHub repo and push: gh repo create ${worker} --private --source . --push\n${c.out.slice(-400)}`);
    } else {
      result.manual.push(`Owner: github.com/new → name "${worker}", Private, no README → then: git remote add origin <url> && git push -u origin main`);
    }
  }
  if (result.repo) {
    fs.writeFileSync(path.join(dir, "LAUNCH.md"), launchDoc({ name: opts.name, domain: opts.domain, sending: opts.sending, worker, repo: result.repo }));
    sh("git", ["commit", "-qam", "launch-kit: checklist with the repo address"], dir);
    sh("git", ["push", "-q"], dir);
  }

  result.ok = true;
  result.worker = worker;
  result.next = "Open LAUNCH.md and go through the owner checklist; then run: node launch.mjs doctor --url https://" + opts.domain;
  return result;
}

function readWorkerName(dir) {
  const p = path.join(dir, "wrangler.jsonc");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8").match(/"name"\s*:\s*"([^"]+)"/)?.[1] ?? null;
}

function launchDoc({ name, domain, sending, worker, repo }) {
  const site = `https://${domain}`;
  const root = apex(domain);
  const repoPath = repo ? repo.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, "") : "<owner>/<repo>";
  return `# Launch checklist: ${name}

Everything in the code is done. These steps need **your** accounts (all free). Paste keys only into the
pages named here, never into a chat. Tick them off as you go; \`node launch.mjs doctor --url ${site}\` checks the result.

Site: **${site}** · Worker: **${worker}** · Email from: **${sending}** · Repo: **${repoPath}**

## 1. Accounts (free)

- [ ] GitHub · Cloudflare · Neon (database) · Resend (email) · Creem (payments, test mode)

## 2. Your domain on Cloudflare

- [ ] **Already bought elsewhere?** Cloudflare → Add a domain → \`${root}\` → Free → it imports your DNS records.
  Before continuing, compare with your current DNS (most often missed: email records like \`resend._domainkey.*\`, MX, SPF).
  Then at your registrar change the **nameservers** to the two Cloudflare gives you.
  (Don't have one yet? Cloudflare → Domains → Buy: renews at cost.)
- [ ] Wait until Cloudflare says the domain is **active** (minutes to a few hours).

## 3. Database

- [ ] Neon → New project → **Connect** → copy the connection string (keep it for step 4).

## 4. Cloudflare Worker (deploys on every push)

- [ ] Workers & Pages → Create → **Import a repository** → GitHub → \`${repoPath}\`
  - Project name: \`${worker}\`
  - Build command: \`npx opennextjs-cloudflare build\`
  - Deploy command: \`npx opennextjs-cloudflare deploy\`
- [ ] Settings → **Builds → Variables and secrets** → \`DATABASE_URL\` (Secret) → **Save**. The build creates/updates the tables with it.
  The first build ran before this existed, so after saving: Deployments → latest build → **Retry build** (or push any commit).
- [ ] Settings → **Variables and Secrets** (runtime). Add them one by one and pick **Secret** for keys:
  pasting a whole .env drops values with spaces (\`EMAIL_FROM\`, \`NEXT_PUBLIC_SITE_NAME\`) and stores everything as plain text.

| Name | Type | Value / where from |
|---|---|---|
| \`DATABASE_URL\` | Secret | Neon → Connect |
| \`BETTER_AUTH_SECRET\` | Secret | 32+ random characters (password manager) |
| \`RESEND_API_KEY\` | Secret | Resend → API Keys → Create (Sending access) |
| \`EMAIL_FROM\` | Text | \`${name} <hello@${sending}>\` |
| \`CREEM_API_KEY\` | Secret | Creem (Test Mode) → Developers → API key |
| \`CREEM_WEBHOOK_SECRET\` | Secret | Creem → Developers → Webhooks (step 6) |
| \`CREEM_PRODUCT_ID\` | Text | Creem → Products → a one-time product → \`prod_…\` |
| \`CREEM_SUBSCRIPTION_PRODUCT_ID\` | Text | Creem → Products → a **Subscription** (monthly) product → \`prod_…\` |
| \`NEXT_PUBLIC_SITE_URL\` | Text | \`${site}\` |
| \`NEXT_PUBLIC_SITE_NAME\` | Text | \`${name}\` |

- [ ] Settings → **Domains** → Add Domain → \`${root}\` → subdomain \`${domain === root ? "(empty)" : domain.slice(0, -root.length - 1)}\`.
  If it says the hostname already has DNS records: DNS → Records → delete that old record (often a CNAME to your previous host), then add again.

## 5. Email (Resend)

- [ ] Resend → Domains → Add \`${sending}\` → **Auto configure** with Cloudflare (or add the records it lists in Cloudflare → DNS, all "DNS only").
- [ ] Wait for **Verified**. \`node <email-send>/scripts/check.mjs --domain ${sending}\` explains what's missing.

## 6. Payments (Creem, test mode)

- [ ] Products: one one-time product and one **Subscription → Monthly** product (IDs into step 4).
- [ ] Developers → Webhooks → New → \`${site}/api/pay/webhook\` → all events → copy the signing secret into \`CREEM_WEBHOOK_SECRET\`.

## 7. Backups and payment catch-up (GitHub)

- [ ] github.com/${repoPath}/settings/secrets/actions → New repository secret:
  \`DATABASE_URL\` (same as above) and \`DB_BACKUP_PASSPHRASE\` (16+ random characters, keep a copy in your password manager).
- [ ] Actions → **Database backup** → Run workflow → green ✅.

## 8. Check everything

- [ ] \`node launch.mjs doctor --url ${site}\` → all ✅
- [ ] Sign in at ${site}/login with an email code → ${site}/pricing → pay with test card \`4111 1111 1111 1111\` → ${site}/members unlocked
- [ ] ${site}/billing → subscribe → "renews on …"

## Before taking real money

See the launch-kit's \`references/go-live.md\`: Creem store verification + payout account, live keys and products, a privacy page, a restore drill.
`;
}

// ---------------------------------------------------------------------------------------------
// status

function status() {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stack = readStack(dir);
  if (!stack) throw Object.assign(new Error("No stack.json here — run: node launch.mjs build ..."), { code: 3 });
  const steps = STEPS.map((s) => ({ skill: s.skill, label: s.label, done: Boolean(stack.installed?.[s.skill]) }));
  const migration = fs.existsSync(path.join(dir, "drizzle")) && fs.readdirSync(path.join(dir, "drizzle")).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(dir, "drizzle", f), "utf8").includes('"pay_subscriptions"'));
  const remote = sh("git", ["remote", "get-url", "origin"], dir);
  const doc = path.join(dir, "LAUNCH.md");
  const owner = fs.existsSync(doc) ? (fs.readFileSync(doc, "utf8").match(/- \[[ x]\][^\n]*/g) || []).map((l) => ({ done: l.startsWith("- [x]"), item: l.slice(6).trim() })) : [];
  const r = { ok: true, command: "status", siteUrl: stack.launch?.siteUrl ?? null, code: steps, migration, repo: remote.ok ? remote.out : null, owner };
  if (!opts.json) {
    log(`Site: ${r.siteUrl ?? "(no domain yet)"}   Repo: ${r.repo ?? "not on GitHub yet"}`);
    log("\nCode (the agent):");
    for (const s of steps) log(`  ${s.done ? "✅" : "⬜"} ${s.label}`);
    log(`  ${migration ? "✅" : "⬜"} Database migration generated`);
    if (owner.length) {
      log(`\nOwner checklist (LAUNCH.md): ${owner.filter((o) => o.done).length}/${owner.length} ticked`);
      for (const o of owner.filter((x) => !x.done).slice(0, 6)) log(`  ⬜ ${o.item.replace(/\*\*/g, "").slice(0, 110)}`);
    }
    log(`\nThen: node launch.mjs doctor --url ${r.siteUrl ?? "https://<your-domain>"}`);
  }
  return r;
}

// ---------------------------------------------------------------------------------------------
// doctor

async function dns(name, type) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
    const j = await r.json();
    return (j.Answer || []).map((a) => String(a.data));
  } catch {
    return null;
  }
}
async function get(url, init) {
  try {
    const r = await fetch(url, { redirect: "manual", ...init, signal: AbortSignal.timeout(20000) });
    return { status: r.status, headers: r.headers, text: await r.text() };
  } catch (e) {
    return { status: 0, error: String(e?.cause?.code || e?.message || e), text: "", headers: new Headers() };
  }
}

async function doctor() {
  if (!/^https:\/\/[^/\s]+$/.test(opts.url || "")) throw Object.assign(new Error("--url https://your-domain is required"), { code: 64 });
  const host = new URL(opts.url).host;
  const root = apex(host);
  const sending = opts.sending || `mail.${root}`;
  const checks = [];
  const add = (area, name, ok, fix, detail) => checks.push({ area, name, ok, fix: ok ? undefined : fix, detail });

  // Hosting
  const ns = await dns(root, "NS");
  add("Domain", `${root} uses Cloudflare DNS`, Boolean(ns?.some((n) => /\.ns\.cloudflare\.com\.?$/.test(n))), "Cloudflare → Add a domain, then change the nameservers at your registrar (LAUNCH.md step 2)", ns?.join(", "));
  const home = await get(`${opts.url}/status`);
  add("Hosting", `${host} answers over HTTPS`, home.status > 0 && home.status < 500, "Worker → Settings → Domains → Add Domain (delete an old DNS record for this name first if it complains)", home.error || `HTTP ${home.status}`);
  add("Hosting", "served by Cloudflare Workers", /Cloudflare/.test(home.text) || home.headers.get("server") === "cloudflare", "Make sure the custom domain is attached to the Worker, not pointing at another host", home.headers.get("server") || "");

  // Database
  const health = await get(`${opts.url}/api/health`);
  let hj = {};
  try { hj = JSON.parse(health.text); } catch { /* not JSON */ }
  add("Database", "connected", hj?.database?.status === "connected", hj?.database?.status === "not configured" ? "Add DATABASE_URL (Secret) in Worker → Settings → Variables and Secrets" : "Check DATABASE_URL; Worker → Logs shows '[health] database check failed'", hj?.database ? `${hj.database.status}${hj.database.latencyMs ? ` · ${hj.database.latencyMs} ms` : ""}` : `HTTP ${health.status}`);

  // Sign-in + email
  const login = await get(`${opts.url}/login`);
  add("Sign-in", "/login works", login.status === 200 && !/BETTER_AUTH_SECRET/.test(login.text), "Add BETTER_AUTH_SECRET (Secret, 32+ random characters)", `HTTP ${login.status}`);
  const dkim = await dns(`resend._domainkey.${sending}`, "TXT");
  add("Email", `DKIM record for ${sending}`, Boolean(dkim?.length), "Resend → Domains → Auto configure with Cloudflare, or add resend._domainkey record (DNS only)", dkim?.length ? "found" : "missing");
  const ret = (await dns(`send.${sending}`, "MX"))?.length || (await dns(`send.${sending}`, "CNAME"))?.length;
  add("Email", `return path send.${sending}`, Boolean(ret), "Add the send.* record Resend lists (DNS only, not proxied)", ret ? "found" : "missing");

  // Payments
  const pricing = await get(`${opts.url}/pricing`);
  add("Payments", "/pricing connected to Creem", pricing.status === 200 && !/aren.t connected/.test(pricing.text), "Add CREEM_API_KEY (Secret) and CREEM_PRODUCT_ID", `HTTP ${pricing.status}`);
  const billing = await get(`${opts.url}/billing`);
  add("Payments", "/billing has a monthly plan", billing.status === 200 && !/CREEM_SUBSCRIPTION_PRODUCT_ID/.test(billing.text), "Create a Subscription product in Creem, set CREEM_SUBSCRIPTION_PRODUCT_ID", `HTTP ${billing.status}`);
  const hook = await get(`${opts.url}/api/pay/webhook`, { method: "POST", headers: { "creem-signature": "doctor" }, body: "{}" });
  add("Payments", "webhook rejects fake notifications", hook.status === 401, "The /api/pay/webhook route is missing or crashing; redeploy", `HTTP ${hook.status}`);
  const rec = await get(`${opts.url}/api/pay/reconcile`, { method: "POST" });
  add("Payments", "payment tables exist + catch-up answers", rec.status === 200, rec.status === 503 ? "Add CREEM_API_KEY" : "Tables missing? Worker → Settings → Builds → Variables and secrets → DATABASE_URL (Secret), then Retry build. Otherwise see Worker → Logs", `HTTP ${rec.status}`);

  const failed = checks.filter((c) => !c.ok);
  if (!opts.json) {
    let area = "";
    for (const c of checks) {
      if (c.area !== area) { area = c.area; log(`\n${area}`); }
      log(`  ${c.ok ? "✅" : "❌"} ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
      if (!c.ok) log(`     → ${c.fix}`);
    }
    log(`\n${failed.length ? `${failed.length} to fix.` : "All green. Next: a test purchase and a test subscription (LAUNCH.md step 8)."} Not checked here: GitHub backup secrets (Actions → Database backup → Run).`);
  }
  return { ok: failed.length === 0, command: "doctor", url: opts.url, passed: checks.length - failed.length, total: checks.length, checks };
}

// ---------------------------------------------------------------------------------------------

try {
  let result;
  if (cmd === "build") result = build();
  else if (cmd === "status") result = status();
  else if (cmd === "doctor") result = await doctor();
  else help(cmd ? 64 : 0);
  if (result.error) { console.error(`✖ ${result.error}`); if (result.hint) console.error(result.hint); process.exitCode = 1; }
  else if (cmd === "build" && !opts.json) {
    for (const s of result.steps) log(`${s.status === "failed" ? "✖" : "✅"} ${s.skill} — ${s.status}`);
    for (const w of result.warnings) log(`⚠ ${w}`);
    for (const m of result.manual) log(`⚠ Needs a hand: ${m}`);
    log(`\n${result.next}`);
  }
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (cmd === "doctor" && !result.ok) process.exitCode = 2;
} catch (e) {
  console.error(`✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  if (opts.json) process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + "\n");
  process.exitCode = e.code || 1;
}
