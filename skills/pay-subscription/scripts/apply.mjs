#!/usr/bin/env node
/**
 * pay-subscription — charge every month automatically (Creem subscriptions, on top of pay-webhook).
 *
 *   node apply.mjs --dir ./my-shop            patch the project (safe to run twice)
 *   node apply.mjs ... --check                show what would change, change nothing
 *   node apply.mjs ... --json                 machine-readable result
 *   node apply.mjs ... --no-git --no-generate skip the commit / the migration step
 *
 * Adds pay_subscriptions, src/lib/pay-subscription.ts (webhook handler, access rules, Creem portal),
 * /billing (subscribe, status, next renewal, manage or cancel), plugs the handler into
 * /api/pay/webhook, and lets /members open for subscribers. No new secrets or packages: the owner
 * creates a monthly product in Creem and sets CREEM_SUBSCRIPTION_PRODUCT_ID (not a secret).
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
  "src/db/schema/pay-subscription.ts",
  "src/lib/pay-subscription.ts",
  "src/app/billing/page.tsx",
  "src/app/api/pay/webhook/route.ts",
];
// Files from earlier skills we may replace, only if the owner never edited them.
const PREVIOUS = {
  "src/app/api/pay/webhook/route.ts": ["6cd61b1b588ab60b6a0b65de209e96efb5caab06be461e1a30c8692d66c42b0e"], // pay-webhook 1.x
};
const PATCHES = [
  {
    file: "src/app/members/page.tsx",
    edits: [
      ['import { ensureGrants, listGrants } from "@/lib/pay-webhook";', 'import { ensureGrants, listGrants } from "@/lib/pay-webhook";\nimport { hasActiveSubscription } from "@/lib/pay-subscription";'],
      ["  const unlocked = active.length > 0;", "  const unlocked = active.length > 0 || (await hasActiveSubscription(user.id));"],
      ["            See pricing\n          </Link>", '            See pricing\n          </Link>\n          <Link href="/billing" className="w-fit text-sm font-bold underline">\n            Or subscribe monthly\n          </Link>'],
    ],
    done: "hasActiveSubscription",
    note: "let subscribers in: unlocked = active.length > 0 || (await hasActiveSubscription(user.id))",
  },
];

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
const result = { ok: false, skill: "pay-subscription", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

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
  const cur = fs.readFileSync(to, "utf8");
  if (cur === content) return;
  if ((PREVIOUS[rel] || []).includes(sha(cur))) return write(dir, rel, content);
  result.skipped.push(`${rel} (exists, kept yours)`);
  if (rel.endsWith("webhook/route.ts")) result.manual.push(`Your ${rel} was edited: call handleCreemEvent(event, [handleSubscriptionEvent]) (import it from src/lib/pay-subscription.ts)`);
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["pay-webhook"]) throw Object.assign(new Error("pay-webhook is not installed — subscriptions are run by its webhook"), { code: 3, hint: "Install pay-webhook first (episode 012)." });
  const lib = path.join(dir, "src/lib/pay-webhook.ts");
  if (!fs.existsSync(lib) || !fs.readFileSync(lib, "utf8").includes("CreemHandler")) {
    throw Object.assign(new Error("pay-webhook is older than 1.1.0 (no handler support)"), { code: 3, hint: "Run pay-webhook's apply.mjs again to upgrade it, then this." });
  }

  // 1. Our files
  for (const rel of NEW_FILES) place(dir, rel, fs.readFileSync(path.join(FILES, rel), "utf8"));

  // 2. Let subscribers into /members
  for (const p of PATCHES) {
    const to = path.join(dir, p.file);
    if (!fs.existsSync(to)) continue;
    let cur = fs.readFileSync(to, "utf8");
    if (cur.includes(p.done)) continue;
    if (p.edits.every(([from]) => cur.includes(from))) {
      for (const [from, toStr] of p.edits) cur = cur.replace(from, toStr);
      write(dir, p.file, cur);
    } else result.manual.push(`${p.file} was edited, so it wasn't patched: ${p.note}`);
  }

  // 3. Schema index
  const idxPath = path.join(dir, "src/db/schema/index.ts");
  const idx = fs.readFileSync(idxPath, "utf8");
  if (!/from\s+["']\.\/pay-subscription["']/.test(idx)) write(dir, "src/db/schema/index.ts", idx.trimEnd() + '\nexport * from "./pay-subscription";\n');

  // 4. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/CREEM_SUBSCRIPTION_PRODUCT_ID/.test(env)) {
    write(dir, ".env.example", env.trimEnd() + "\n\n# pay-subscription (episode 013)\n# CREEM_SUBSCRIPTION_PRODUCT_ID=prod_...   (a recurring product in Creem, e.g. monthly; not a secret)\n");
  }

  // 5. Record the install
  if (installed["pay-subscription"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "pay-subscription": VERSION } }, null, 2) + "\n");
  }

  // 6. Migration
  const drizzleDir = path.join(dir, "drizzle");
  const hasMigration = fs.existsSync(drizzleDir) &&
    fs.readdirSync(drizzleDir).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(drizzleDir, f), "utf8").includes('"pay_subscriptions"'));
  if (!hasMigration) {
    const kit = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
    if (!opts.check && opts.generate && fs.existsSync(kit)) {
      const g = spawnSync(kit, ["generate", "--name", "pay_subscription"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
      if (g.status === 0) result.changed.push("drizzle/ (pay_subscription migration)");
      else result.manual.push(`Generate the migration: npm run db:generate -- --name pay_subscription\n${g.stderr || g.stdout}`);
    } else {
      result.manual.push("Generate the migration: npm install, then npm run db:generate -- --name pay_subscription, and commit the drizzle/ folder");
    }
  }

  // 7. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add pay-subscription: monthly plans, renewals, cancel, /billing"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Push and wait for the deploy (the migration runs during the build)",
    "Owner: Creem (Test Mode) → Products → Create product → Recurring, monthly, any price → copy its prod_ ID (not a secret)",
    "Set CREEM_SUBSCRIPTION_PRODUCT_ID in the host (plain text) with the owner's OK",
    "Owner: /billing → Subscribe → test card 4111 1111 1111 1111 → back: /billing ✅ Active · renews on <date>, /members Unlocked",
    "Owner: /billing → Manage or cancel → cancel in Creem's portal → /billing shows Canceled · access until <date>",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  for (const s of result.skipped) log("Kept:", s);
  for (const w of result.warnings) log("⚠", w);
  for (const m of result.manual) log("⚠ Needs a hand:", m);
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
