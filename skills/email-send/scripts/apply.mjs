#!/usr/bin/env node
/**
 * email-send — add email sending (Resend, from your own domain) to an app-foundation project.
 *
 *   node apply.mjs --dir ./my-shop --sending-domain mail.example.com
 *   node apply.mjs --dir ./my-shop --check     show what would change, change nothing
 *   node apply.mjs ... --json                  machine-readable result
 *
 * Adds src/lib/email.ts (sendEmail) and the /email-test page, documents the variables
 * in .env.example, records the install in stack.json, and commits.
 * It never touches secrets: RESEND_API_KEY is typed into Vercel by the owner.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.1.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = ["src/lib/email.ts", "src/app/email-test/page.tsx"];
// Earlier versions of our own files: replaced on upgrade only if the owner never edited them.
const PREVIOUS = {
  "src/app/email-test/page.tsx": [
    "00f9ef6212739a31e556286f6dbace67d287b12df872a0a3a1e9181c246bec7f",
    "c36e97e199ddf37cc9eb965187a7ad0dc981ceb3e718a4b322dd9a4cb8920003",
  ],
};
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

const opts = { json: false, check: false, git: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--sending-domain") opts.sendingDomain = (argv[++i] || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}

const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const result = { ok: false, skill: "email-send", version: VERSION, changed: [], skipped: [], warnings: [] };
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
  if (!fs.existsSync(stackPath)) {
    throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), {
      code: 3, hint: "Install app-foundation first (episode 002), or point --dir at the project folder.",
    });
  }
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  if (!stack.installed?.["app-foundation"]) throw Object.assign(new Error("stack.json does not list app-foundation"), { code: 3 });
  if (!stack.installed["db-connect"]) result.warnings.push("db-connect is not installed: emails still send, but the /email-test limits and the send log need a database (episode 003).");
  if (!stack.domain && !opts.sendingDomain) result.warnings.push("No domain recorded yet. To email anyone (not just yourself) you need your own domain: domain-setup (episode 004).");
  if (!fs.existsSync(path.join(dir, "src", "lib", "events.ts"))) throw Object.assign(new Error("src/lib/events.ts is missing (it comes with app-foundation)"), { code: 3 });

  for (const rel of NEW_FILES) {
    const to = path.join(dir, rel);
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    if (!fs.existsSync(to)) write(dir, rel, src);
    else if (fs.readFileSync(to, "utf8") === src) continue;
    else if ((PREVIOUS[rel] || []).includes(sha(to))) write(dir, rel, src);
    else result.skipped.push(`${rel} (you changed it, kept yours — compare with ${path.join(FILES, rel)})`);
  }

  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/RESEND_API_KEY/.test(env)) {
    const d = opts.sendingDomain || (stack.domain ? `mail.${stack.domain.split(".").slice(-2).join(".")}` : "mail.example.com");
    write(dir, ".env.example", env.trimEnd() +
      "\n\n# email-send (episode 005) — set these in Vercel → Settings → Environment Variables.\n" +
      "# RESEND_API_KEY=re_...               (secret: Resend → API Keys, \"Sending access\" only)\n" +
      `# EMAIL_FROM=${stack.name || "我的网站"} <hello@${d}>\n` +
      "# EMAIL_TEST_TO=you@example.com       (where /email-test sends — your own inbox)\n" +
      "# EMAIL_TEST_CODE=...                 (optional secret: lets /email-test send to other addresses)\n" +
      "# EMAIL_REPLY_TO=you@example.com      (optional: where replies go)\n");
  }

  else if (!/EMAIL_TEST_CODE/.test(env)) {
    write(dir, ".env.example", env.replace(/(# EMAIL_TEST_TO=.*\n)/, "$1# EMAIL_TEST_CODE=...                 (optional secret: lets /email-test send to other addresses)\n"));
  }

  const want = { ...stack, installed: { ...stack.installed, "email-send": VERSION } };
  if (opts.sendingDomain) want.email = { ...(stack.email || {}), domain: opts.sendingDomain, provider: "resend" };
  if (JSON.stringify(want) !== JSON.stringify(stack)) write(dir, "stack.json", JSON.stringify(want, null, 2) + "\n");

  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", ...result.changed], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", stack.installed["email-send"] ? `Update email-send to ${VERSION}` : "Add email-send: sendEmail() via Resend and /email-test"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Owner: resend.com → sign up → Domains → Add domain (a subdomain like mail.example.com)",
    "Owner OK, then add the DNS records Resend shows; verify with scripts/check.mjs",
    "Owner: Resend → API Keys → Create (Sending access) → paste into Vercel as RESEND_API_KEY; also set EMAIL_FROM and EMAIL_TEST_TO",
    "Redeploy, open /email-test, send a test email",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  for (const s of result.skipped) log("Kept:", s);
  for (const w of result.warnings) log("⚠", w);
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  console.error(`✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  process.exitCode = e.code || 1;
} finally {
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
