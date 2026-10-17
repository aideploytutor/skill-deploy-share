#!/usr/bin/env node
/**
 * env-secrets (episode 007): find secret keys that ended up where they shouldn't.
 *
 *   node scripts/secret-scan.mjs              scan all tracked files
 *   node scripts/secret-scan.mjs --staged     scan only what is about to be committed (git hook)
 *   node scripts/secret-scan.mjs --history    also scan every past commit
 *   node scripts/secret-scan.mjs --json
 *
 * Read-only. Prints each finding with the key masked. Exit 1 if anything was found.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dirArg = process.argv.indexOf("--dir");
const dir = path.resolve(dirArg > -1 ? process.argv[dirArg + 1] : ".");
const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// [id, label, regex]. Keep patterns specific so real projects don't drown in noise.
const RULES = [
  ["resend", "Resend API key", /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/],
  ["stripe-live", "Stripe live secret key", /\b[rs]k_live_[0-9A-Za-z]{16,}\b/],
  ["openai", "OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ["anthropic", "Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{32,}\b/],
  ["github", "GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["google-oauth", "Google OAuth client secret", /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/],
  ["google-api", "Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["aws", "AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack", "Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["private-key", "Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["db-url", "Database URL with password", /\bpostgres(?:ql)?:\/\/[^:\s/]+:(?!\.\.\.|password|PASSWORD|\$\{)[^@\s]{8,}@[^\s'"]+/],
  ["assigned", "Secret assigned in code", /\b[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD)[A-Z0-9_]*\s*[:=]\s*["'`][A-Za-z0-9/+_=-]{20,}["'`]/],
];
const SKIP = /(^|\/)(node_modules|\.next|dist|build|\.vercel)\/|\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf|lock)$|package-lock\.json$|pnpm-lock\.yaml$/;
const mask = (s) => (s.length <= 10 ? "••••" : `${s.slice(0, 6)}••••${s.slice(-2)}`);

const findings = [];
function scanText(file, text, where) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [id, label, re] of RULES) {
      const m = line.match(re);
      if (m && !/secret-scan:\s*allow/.test(line)) { findings.push({ id, label, file, line: i + 1, where, sample: mask(m[0]) }); break; }
    }
  });
}

try { git("rev-parse", "--is-inside-work-tree"); } catch { console.error("✖ Not a git repository"); process.exit(64); }

// 1. Files that must never be tracked
const tracked = git("ls-files").split("\n").filter(Boolean);
for (const f of tracked) {
  if (/(^|\/)\.env(\.[^/]*)?$/.test(f) && !/\.env\.example$/.test(f)) findings.push({ id: "env-file", label: "A .env file is committed", file: f, line: 0, where: "tracked", sample: "" });
}
const gi = fs.existsSync(path.join(dir, ".gitignore")) ? fs.readFileSync(path.join(dir, ".gitignore"), "utf8") : "";
if (!/^\.env\*?$|^\.env\.local$|^\.env\*\.local$/m.test(gi)) findings.push({ id: "gitignore", label: ".gitignore does not ignore .env files", file: ".gitignore", line: 0, where: "config", sample: "" });

// 2. Content
if (args.has("--staged")) {
  const files = git("diff", "--cached", "--name-only", "--diff-filter=ACM").split("\n").filter((f) => f && !SKIP.test(f));
  for (const f of files) { try { scanText(f, git("show", `:${f}`), "staged"); } catch {} }
} else {
  for (const f of tracked) {
    if (SKIP.test(f)) continue;
    const p = path.join(dir, f);
    try { if (fs.statSync(p).size < 2_000_000) scanText(f, fs.readFileSync(p, "utf8"), "working tree"); } catch {}
  }
}
if (args.has("--history")) {
  const log = git("log", "--all", "-p", "--no-color", "--unified=0", "--format=@@COMMIT %h");
  let commit = "", file = "";
  for (const line of log.split("\n")) {
    if (line.startsWith("@@COMMIT ")) commit = line.slice(9);
    else if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++") && !SKIP.test(file)) {
      for (const [id, label, re] of RULES) {
        const m = line.match(re);
        if (m && !/secret-scan:\s*allow/.test(line)) { findings.push({ id, label, file, line: 0, where: `commit ${commit}`, sample: mask(m[0]) }); break; }
      }
    }
  }
}

// de-duplicate history hits that are also in the working tree
const seen = new Set();
const out = findings.filter((f) => { const k = `${f.id}|${f.file}|${f.sample}|${f.where.startsWith("commit") ? "h" : f.where}`; if (seen.has(k)) return false; seen.add(k); return true; });

if (args.has("--json")) process.stdout.write(JSON.stringify({ ok: out.length === 0, findings: out }, null, 2) + "\n");
else if (!out.length) console.log(`✔ No secrets found (${args.has("--staged") ? "staged changes" : `${tracked.length} tracked files`}${args.has("--history") ? " + full history" : ""}).`);
else {
  console.log(`✖ Found ${out.length} possible secret${out.length > 1 ? "s" : ""}:\n`);
  for (const f of out) console.log(`  ${f.label}${f.sample ? `  ${f.sample}` : ""}\n    ${f.file}${f.line ? `:${f.line}` : ""}  (${f.where})`);
  console.log("\nWhat to do:\n  1. Revoke the key at the provider and create a new one (deleting the file is not enough).\n  2. Put the new key in Vercel → Settings → Environment Variables, or .env.local for your own computer.\n  3. Read the code from process.env.NAME instead of writing the key in the file.\n  Not a real key (an example)? Add the comment  secret-scan: allow  on that line.");
}
process.exitCode = out.length ? 1 : 0;
