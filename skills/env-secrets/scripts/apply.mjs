#!/usr/bin/env node
/**
 * env-secrets — keep secret keys out of code, git and chat.
 *
 *   node apply.mjs --dir ./my-shop           install the scanner + pre-commit guard (safe to run twice)
 *   node apply.mjs --dir ./my-shop --check   show what would change
 *
 * Adds scripts/secret-scan.mjs and .githooks/pre-commit, wires `npm run secrets:scan`,
 * makes `npm install` turn the guard on (core.hooksPath), makes sure .gitignore ignores
 * .env files, records the install, commits, and then runs a full scan (incl. history).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = ["scripts/secret-scan.mjs", ".githooks/pre-commit"];
const PREPARE = `node -e "try{require('child_process').execSync('git config core.hooksPath .githooks',{stdio:'ignore'})}catch(e){}"`;

const opts = { check: false, git: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dir") opts.dir = argv[++i];
  else if (argv[i] === "--check") opts.check = true;
  else if (argv[i] === "--no-git") opts.git = false;
  else { console.error(`✖ unknown option ${argv[i]}`); process.exit(64); }
}
if (!opts.dir) { console.error("✖ usage: node apply.mjs --dir <project>"); process.exit(64); }
const dir = path.resolve(opts.dir);
const changed = [];
const write = (rel, content, mode) => {
  if (!opts.check) { const to = path.join(dir, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, content); if (mode) fs.chmodSync(to, mode); }
  changed.push(rel);
};

for (const rel of NEW_FILES) {
  const src = fs.readFileSync(path.join(FILES, rel), "utf8");
  const to = path.join(dir, rel);
  if (!fs.existsSync(to) || fs.readFileSync(to, "utf8") !== src) write(rel, src, rel.startsWith(".githooks") ? 0o755 : undefined);
}

const pkgPath = path.join(dir, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const s = (pkg.scripts ??= {});
  let ch = false;
  if (s["secrets:scan"] !== "node scripts/secret-scan.mjs") { s["secrets:scan"] = "node scripts/secret-scan.mjs"; ch = true; }
  if (!String(s.prepare || "").includes("core.hooksPath")) { s.prepare = s.prepare ? `${s.prepare} && ${PREPARE}` : PREPARE; ch = true; }
  if (ch) write("package.json", JSON.stringify(pkg, null, 2) + "\n");
}

const giPath = path.join(dir, ".gitignore");
const gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, "utf8") : "";
if (!/^\.env\*?$/m.test(gi)) write(".gitignore", gi.trimEnd() + "\n\n# env-secrets: never commit real keys (.env.example is fine)\n.env*\n!.env.example\n");

const stackPath = path.join(dir, "stack.json");
if (fs.existsSync(stackPath)) {
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  if (stack.installed?.["env-secrets"] !== VERSION) write("stack.json", JSON.stringify({ ...stack, installed: { ...stack.installed, "env-secrets": VERSION } }, null, 2) + "\n");
}

console.log(opts.check ? "Would change:" : "Changed:", changed.length ? changed.join(", ") : "nothing");
if (opts.check) process.exit(0);

if (fs.existsSync(path.join(dir, ".git"))) {
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: dir });
  if (opts.git && changed.length) {
    spawnSync("git", ["add", ...changed], { cwd: dir });
    spawnSync("git", ["commit", "-q", "-m", "Add env-secrets: secret scan + pre-commit guard"], { cwd: dir });
  }
  console.log("✔ Pre-commit guard is on (git config core.hooksPath .githooks)\n");
  const r = spawnSync(process.execPath, ["scripts/secret-scan.mjs", "--history"], { cwd: dir, stdio: "inherit" });
  process.exitCode = r.status ?? 0;
}
