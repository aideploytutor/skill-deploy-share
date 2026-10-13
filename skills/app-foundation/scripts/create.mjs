#!/usr/bin/env node
/**
 * app-foundation — create a new project from the foundation template.
 *
 *   node create.mjs --dir ./my-shop --name "我的小店"        create + npm install + git init
 *   node create.mjs --dir ./my-shop --name "我的小店" --no-install
 *   node create.mjs --check --dir ./my-shop                    verify an existing project
 *   node create.mjs --json ...                                  machine-readable result
 *
 * Needs Node.js 20.9+ (Next.js 16 requirement) and npm. Cross-platform.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(here, "..", "template");

const opts = { install: true, git: true, json: false, check: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => {
    const v = argv[++i];
    if (v === undefined) usage(`${a} needs a value`);
    return v;
  };
  if (a === "--dir") opts.dir = val();
  else if (a === "--name") opts.name = val();
  else if (a === "--slug") opts.slug = val();
  else if (a === "--no-install") opts.install = false;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--json") opts.json = true;
  else if (a === "--check") opts.check = true;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else usage(`unknown option ${a}`);
}
function usage(msg) { console.error(`✖ ${msg} (see --help)`); process.exit(64); }

const result = { ok: false, skill: "app-foundation", version: VERSION };
const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
class Fail extends Error { constructor(m, code = 1, hint) { super(m); this.code = code; this.hint = hint; } }

function run(cmd, args, cwd) {
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin && cmd === "npm" ? "npm.cmd" : cmd, args, {
    cwd, stdio: opts.json ? ["ignore", "pipe", "pipe"] : "inherit", shell: isWin && cmd === "npm",
    encoding: "utf8", windowsHide: true,
  });
  if (r.error?.code === "ENOENT") return { ok: false, missing: true };
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

function slugify(s) {
  const ascii = s.toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ascii;
}

function copyTemplate(dest, vars) {
  for (const entry of fs.readdirSync(TEMPLATE, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const from = path.join(entry.parentPath ?? entry.path, entry.name);
    const rel = path.relative(TEMPLATE, from);
    const to = path.join(dest, rel.replace(/(^|[\\/])_gitignore$/, "$1.gitignore"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (/\.(ts|tsx|json|md|css|mjs|example|svg)$|_gitignore$|\.env\.example$/.test(from)) {
      let text = fs.readFileSync(from, "utf8");
      for (const [k, v] of Object.entries(vars)) text = text.split(k).join(v);
      fs.writeFileSync(to, text);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

const REQUIRED = ["package.json", "stack.json", "AGENTS.md", "src/db/index.ts", "src/db/schema/index.ts", "src/lib/events.ts", "src/app/api/health/route.ts", ".gitignore"];

function check(dir) {
  const missing = REQUIRED.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) throw new Fail(`Not a complete foundation project, missing: ${missing.join(", ")}`, 3);
  const stack = JSON.parse(fs.readFileSync(path.join(dir, "stack.json"), "utf8"));
  if (!stack.installed?.["app-foundation"]) throw new Fail("stack.json does not list app-foundation", 3);
  return stack;
}

try {
  const major = Number(process.versions.node.split(".")[0]);
  const minor = Number(process.versions.node.split(".")[1]);
  if (major < 20 || (major === 20 && minor < 9)) {
    throw new Fail(`Node.js ${process.versions.node} is too old; Next.js 16 needs 20.9 or newer`, 3,
      "Install the LTS version from https://nodejs.org, open a new terminal, and run this again.");
  }
  if (!opts.dir) usage("--dir is required");
  const dir = path.resolve(opts.dir);

  if (opts.check) {
    const stack = check(dir);
    Object.assign(result, { ok: true, dir, installed: stack.installed });
    log(`✔ ${dir} is a foundation project. Installed: ${Object.keys(stack.installed).join(", ")}`);
  } else {
    if (fs.existsSync(dir) && fs.readdirSync(dir).filter((f) => f !== ".git").length) {
      throw new Fail(`${dir} already exists and is not empty`, 10,
        "Pick a new folder name, or ask the owner whether to install the foundation into this existing project (not supported automatically).");
    }
    const name = opts.name || path.basename(dir);
    const slug = opts.slug || slugify(name) || slugify(path.basename(dir)) || "my-app";
    copyTemplate(dir, { __APP_NAME__: name, __APP_SLUG__: slug });
    const stack = {
      $schema: "https://github.com/aideploytutor/skill-deploy-share/blob/main/STACK.md",
      name,
      createdAt: new Date().toLocaleDateString("sv-SE"),
      installed: { "app-foundation": VERSION },
    };
    fs.writeFileSync(path.join(dir, "stack.json"), JSON.stringify(stack, null, 2) + "\n");
    fs.copyFileSync(path.join(dir, ".env.example"), path.join(dir, ".env.local"));
    log(`✔ Created ${dir}`);

    if (opts.install) {
      log("… Installing packages (first time takes 1–3 minutes)");
      const r = run("npm", ["install", "--no-audit", "--no-fund"], dir);
      if (r.missing) throw new Fail("npm not found", 3, "Install Node.js LTS from https://nodejs.org (npm comes with it), then open a new terminal.");
      if (!r.ok) throw new Fail("npm install failed", 4, (r.out || "").slice(-1500) + "\nCheck the network, then run `npm install` in the project folder.");
      log("✔ Packages installed");
    }
    if (opts.git) {
      const g = run("git", ["init", "-b", "main"], dir);
      if (g.ok) {
        run("git", ["add", "-A"], dir);
        const c = run("git", ["-c", "user.name=app-foundation", "-c", "user.email=app-foundation@users.noreply.github.com", "commit", "-q", "-m", "Create project with app-foundation"], dir);
        log(c.ok ? "✔ First save point created (git)" : "… git commit skipped");
      } else {
        log("… git not found, skipped (install it before deploying: episode 001)");
      }
    }
    check(dir);
    Object.assign(result, { ok: true, dir, name, slug, installed: stack.installed, next: ["npm run dev", "db-connect (episode 003)", "github-vercel-deploy (episode 001)"] });
    log(`\nDone. Open the folder and run:  npm run dev   → http://localhost:3000`);
  }
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  console.error(`\n✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  process.exitCode = e.code || 1;
} finally {
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
