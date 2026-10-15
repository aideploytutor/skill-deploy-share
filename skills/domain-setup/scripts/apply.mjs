#!/usr/bin/env node
/**
 * domain-setup — record the custom domain in an app-foundation project.
 *
 *   node apply.mjs --dir ./my-shop --domain shop.example.com
 *
 * Writes stack.json → domain, documents NEXT_PUBLIC_SITE_URL in .env.example,
 * and commits. DNS itself is changed at the user's DNS provider, not here.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const VERSION = "1.0.0";
const opts = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dir") opts.dir = argv[++i];
  else if (argv[i] === "--domain") opts.domain = (argv[++i] || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  else if (argv[i] === "--no-git") opts.noGit = true;
  else { console.error(`✖ unknown option ${argv[i]}`); process.exit(64); }
}
if (!opts.dir || !opts.domain) { console.error("✖ usage: node apply.mjs --dir <project> --domain <domain>"); process.exit(64); }

const dir = path.resolve(opts.dir);
const stackPath = path.join(dir, "stack.json");
if (!fs.existsSync(stackPath)) { console.error("✖ No stack.json — not an app-foundation project"); process.exit(3); }

const changed = [];
const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
if (stack.domain !== opts.domain || stack.installed?.["domain-setup"] !== VERSION) {
  stack.domain = opts.domain;
  stack.installed = { ...stack.installed, "domain-setup": VERSION };
  fs.writeFileSync(stackPath, JSON.stringify(stack, null, 2) + "\n");
  changed.push("stack.json");
}

const envPath = path.join(dir, ".env.example");
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
if (!/NEXT_PUBLIC_SITE_URL=/.test(env)) {
  fs.writeFileSync(envPath, env.trimEnd() + `\n\n# domain-setup (episode 004) — your public address, not a secret\nNEXT_PUBLIC_SITE_URL=https://${opts.domain}\n`);
  changed.push(".env.example");
}

if (changed.length && !opts.noGit && fs.existsSync(path.join(dir, ".git"))) {
  spawnSync("git", ["add", ...changed], { cwd: dir });
  spawnSync("git", ["commit", "-q", "-m", `Use custom domain ${opts.domain}`], { cwd: dir });
}
console.log(changed.length ? `✔ Recorded ${opts.domain} (${changed.join(", ")})` : `✔ ${opts.domain} already recorded`);
