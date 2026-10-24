#!/usr/bin/env node
/**
 * pay-webhook — handle every payment automatically, never miss one (Creem, on top of pay-checkout).
 *
 *   node apply.mjs --dir ./my-shop --url https://my-shop.com   patch the project (safe to run twice)
 *   node apply.mjs ... --check                                  show what would change, change nothing
 *   node apply.mjs ... --json                                   machine-readable result
 *   node apply.mjs ... --no-git --no-generate                   skip the commit / the migration step
 *
 * Adds pay_webhook_events (each Creem notification handled once) and pay_grants (what a payment
 * unlocks; refunds and chargebacks take it away), src/lib/pay-webhook.ts, a new /api/pay/webhook
 * (payments, refunds, chargebacks; 500 on failure so Creem retries), /api/pay/reconcile + an hourly
 * GitHub Actions catch-up, and a /members page that only buyers can open. No new secrets, no new packages.
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
  "src/db/schema/pay-webhook.ts",
  "src/lib/pay-webhook.ts",
  "src/app/api/pay/webhook/route.ts",
  "src/app/api/pay/reconcile/route.ts",
  "src/app/members/page.tsx",
];
const WORKFLOW = ".github/workflows/pay-reconcile.yml";
// Earlier versions we may replace: pay-checkout 1.0.0's webhook route (only if the owner never edited it).
const PREVIOUS = {
  "src/app/api/pay/webhook/route.ts": ["cc6f48a49859d8b6d615be1ee5747247a3dbd96907fb585836aea92dffdf8235"],
};
// Small edits to pay-checkout's pages (skipped with a note if the owner changed those lines).
const PATCHES = [
  {
    file: "src/app/pricing/page.tsx",
    from: '{p.status === "paid" ? "✅ Paid" : "⏳ Not completed"}',
    to: '{({ paid: "✅ Paid", refunded: "↩️ Refunded", disputed: "⚠️ Disputed" } as Record<string, string>)[p.status] ?? "⏳ Not completed"}',
    done: "↩️ Refunded",
  },
  {
    file: "src/app/pay/success/page.tsx",
    from: '      <Link href="/pricing" className="rounded-full border border-line px-6 py-3 font-bold">Back to pricing</Link>',
    to: '      {state === "paid" && <Link href="/members" className="rounded-full bg-accent px-6 py-3 font-bold text-white">Open members area</Link>}\n      <Link href="/pricing" className="rounded-full border border-line px-6 py-3 font-bold">Back to pricing</Link>',
    done: 'href="/members"',
  },
];

const opts = { json: false, check: false, git: true, generate: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--url") opts.url = argv[++i];
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--no-generate") opts.generate = false;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}

const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const result = { ok: false, skill: "pay-webhook", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
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
  if (rel.endsWith("webhook/route.ts")) result.manual.push(`Your ${rel} was edited: make it call handleCreemEvent() from src/lib/pay-webhook.ts (see the skill's files/ for the full version)`);
}
function envUrl(dir) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^NEXT_PUBLIC_SITE_URL=["']?(https?:\/\/[^"'\s]+)/m);
    if (m) return m[1];
  }
  return "";
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["pay-checkout"]) throw Object.assign(new Error("pay-checkout is not installed — there are no payments to handle yet"), { code: 3, hint: "Install pay-checkout first (episode 010)." });

  // 1. Our files
  for (const rel of NEW_FILES) place(dir, rel, fs.readFileSync(path.join(FILES, rel), "utf8"));

  // 2. Small edits to pay-checkout's pages
  for (const p of PATCHES) {
    const to = path.join(dir, p.file);
    if (!fs.existsSync(to)) continue;
    const cur = fs.readFileSync(to, "utf8");
    if (cur.includes(p.done)) continue;
    if (cur.includes(p.from)) write(dir, p.file, cur.replace(p.from, p.to));
    else result.manual.push(`${p.file} was edited, so it wasn't patched: ${p.file.includes("pricing") ? 'show "Refunded" for status "refunded"' : "add a link to /members after a successful payment"}`);
  }

  // 3. Schema index
  const idxPath = path.join(dir, "src/db/schema/index.ts");
  const idx = fs.readFileSync(idxPath, "utf8");
  if (!/from\s+["']\.\/pay-webhook["']/.test(idx)) write(dir, "src/db/schema/index.ts", idx.trimEnd() + '\nexport * from "./pay-webhook";\n');

  // 4. Hourly catch-up workflow (needs the public address of the site)
  const url = (opts.url || envUrl(dir)).replace(/\/$/, "");
  if (/^https:\/\/[^/\s]+$/.test(url)) {
    place(dir, WORKFLOW, fs.readFileSync(path.join(FILES, WORKFLOW), "utf8").replace("__SITE_URL__", url));
    result.siteUrl = url;
  } else {
    result.warnings.push("No site address given, so the hourly catch-up wasn't added. Run again with --url https://<your-site>.");
  }

  // 5. Record the install
  if (installed["pay-webhook"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "pay-webhook": VERSION } }, null, 2) + "\n");
  }

  // 6. Migration for pay_webhook_events + pay_grants
  const drizzleDir = path.join(dir, "drizzle");
  const hasMigration = fs.existsSync(drizzleDir) &&
    fs.readdirSync(drizzleDir).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(drizzleDir, f), "utf8").includes('"pay_grants"'));
  if (!hasMigration) {
    const kit = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
    if (!opts.check && opts.generate && fs.existsSync(kit)) {
      const g = spawnSync(kit, ["generate", "--name", "pay_webhook"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
      if (g.status === 0) result.changed.push("drizzle/ (pay_webhook migration)");
      else result.manual.push(`Generate the migration: npm run db:generate -- --name pay_webhook\n${g.stderr || g.stdout}`);
    } else {
      result.manual.push("Generate the migration: npm install, then npm run db:generate -- --name pay_webhook, and commit the drizzle/ folder");
    }
  }

  // 7. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add pay-webhook: refunds, chargebacks, access grants, hourly payment catch-up"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Push and wait for the deploy (the migration runs during the build)",
    "Owner: Creem → Developers → Webhooks → edit the /api/pay/webhook endpoint → make sure refund.created and dispute.created are ticked (or all events)",
    "Test: buy with the test card → /members shows Unlocked → refund that payment in Creem → /members shows Locked, /pricing shows Refunded",
    "GitHub → Actions → Payment catch-up → Run workflow → green, summary shows {checked, recovered, repaired}",
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
