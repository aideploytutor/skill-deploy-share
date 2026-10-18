#!/usr/bin/env node
/**
 * github-vercel-deploy — push a local folder to GitHub, create a Vercel project, link the repo and deploy.
 *
 * Needs only git + Node.js 18+; everything goes through the GitHub / Vercel REST APIs:
 *   - no gh or vercel CLI (avoids the Windows "not on PATH" problem)
 *   - no interactive login (never stuck at "Waiting for authentication...")
 *   - detects when Vercel's linked GitHub account doesn't own the repo
 *
 * Usage:
 *   node deploy.mjs --check                    check only, change nothing
 *   node deploy.mjs --dir ./my-app --yes       deploy (private repo)
 *   node deploy.mjs --dir ./my-app --public    deploy (public repo)
 *   node deploy.mjs --help
 *
 * Needs two tokens (environment variables or .env.deploy only; never paste them into a chat):
 *   GITHUB_TOKEN  https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy
 *   VERCEL_TOKEN  https://vercel.com/account/tokens
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

// ---------------------------------------------------------------- options

const HELP = `Usage: node deploy.mjs [options]

  --dir <path>        project folder (default: current directory)
  --name <name>       GitHub repo / Vercel project name (default: folder name)
  --public            create a public repo (default: private)
  --branch <branch>   branch to deploy (default: current branch or main)
  --team <slug|id>    Vercel team (default: personal account)
  --framework <name>  Vercel framework preset, e.g. nextjs, vite (default: auto-detect)
  --message <text>    commit message (default "Deploy via github-vercel-deploy")
  --yes               don't ask, just do it (for agents / CI)
  --check             check environment and accounts only, change nothing
  --allow-secrets     skip the secret scan (not recommended)
  --json              print a JSON result at the end (for programs)
  --help              show this help

Tokens (environment variables, or a .env.deploy file in the project or your home folder):
  GITHUB_TOKEN (or GH_TOKEN)  needs the repo scope
  VERCEL_TOKEN
`;

function usageError(msg) {
  console.error(`✖ ${msg}`);
  process.exit(64);
}

function parseArgs(argv) {
  const o = { dir: ".", public: false, yes: false, check: false, json: false, allowSecrets: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) usageError(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case "--dir": o.dir = val(); break;
      case "--name": o.name = val(); break;
      case "--branch": o.branch = val(); break;
      case "--team": o.team = val(); break;
      case "--framework": o.framework = val(); break;
      case "--message": o.message = val(); break;
      case "--public": o.public = true; break;
      case "--private": o.public = false; break;
      case "--yes": case "-y": o.yes = true; break;
      case "--check": o.check = true; break;
      case "--json": o.json = true; break;
      case "--allow-secrets": o.allowSecrets = true; break;
      case "--help": case "-h": process.stdout.write(HELP); process.exit(0);
      default: usageError(`unknown option: ${a} (see --help)`);
    }
  }
  return o;
}

// ---------------------------------------------------------------- output

const opts = parseArgs(process.argv.slice(2));
const result = { ok: false, steps: [] };
const log = (...m) => { if (!opts.json) console.log(...m); else console.error(...m); };
const step = (t) => { result.steps.push(t); log(`\n== ${t} ==`); };

class DeployError extends Error {
  constructor(msg, code = 1, hint) { super(msg); this.code = code; this.hint = hint; }
}
function fail(msg, code = 1, hint) { throw new DeployError(msg, code, hint); }

// ---------------------------------------------------------------- helpers

function run(cmd, args, { cwd, env, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, env: { ...process.env, ...env }, encoding: "utf8",
    shell: false, windowsHide: true,
  });
  if (r.error && r.error.code === "ENOENT") {
    if (allowFail) return { ok: false, out: "", err: "ENOENT" };
    fail(`command not found: ${cmd}`, 3, installHint(cmd));
  }
  const ok = r.status === 0;
  if (!ok && !allowFail) {
    fail(`${cmd} ${args.join(" ")} failed:\n${(r.stderr || r.stdout || "").trim()}`);
  }
  return { ok, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function installHint(cmd) {
  const p = process.platform;
  if (cmd === "git") {
    if (p === "win32") return "Install: winget install --id Git.Git -e   (then open a new terminal)";
    if (p === "darwin") return "Install: xcode-select --install   or   brew install git";
    return "Install: sudo apt install git   (or your system's package manager)";
  }
  return "";
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function confirm(question) {
  if (opts.yes) return true;
  if (!process.stdin.isTTY) {
    fail(`needs confirmation: ${question}`, 10,
      "Not an interactive terminal. Re-run with --yes once confirmed (agents: ask the user first, add --yes only after they agree).");
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${question} (y/N) `)).trim().toLowerCase();
  rl.close();
  return a === "y" || a === "yes";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- API

const GH_API = process.env.SKILL_DEPLOY_GITHUB_API || "https://api.github.com";
const VC_API = process.env.SKILL_DEPLOY_VERCEL_API || "https://api.vercel.com";

async function api(base, token, method, p, body) {
  let res;
  try {
    res = await fetch(base + p, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "github-vercel-deploy",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    fail(`cannot reach ${base}: ${e.cause?.code || e.message}`, 4, "Check your network or proxy settings.");
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}
const gh = (m, p, b) => api(GH_API, process.env.GITHUB_TOKEN, m, p, b);
const vc = (m, p, b) => api(VC_API, process.env.VERCEL_TOKEN, m, p, b);
const vcErr = (d) => d?.error?.message || d?.message || JSON.stringify(d);

// ---------------------------------------------------------------- secret scan

const SECRET_NAME = /(^|\/)(\.env(\.(?!example$|sample$|template$)[^/]*)?|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa[^/]*|id_ed25519[^/]*|credentials[^/]*\.json|service-account[^/]*\.json|\.npmrc|\.env\.deploy)$/i;
const SECRET_BODY = [
  /ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{40,}/, /\bsk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

function scanSecrets(dir, files) {
  const hits = [];
  for (const f of files) {
    if (SECRET_NAME.test(f)) { hits.push(`${f} (file name looks like a secrets file)`); continue; }
    const full = path.join(dir, f);
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile() || st.size > 1_000_000) continue;
    const body = fs.readFileSync(full, "utf8");
    if (body.includes("\u0000")) continue; // binary
    if (SECRET_BODY.some((re) => re.test(body))) hits.push(`${f} (contains what looks like a token or private key)`);
  }
  return hits;
}

const BASE_IGNORES = ["node_modules/", ".env", ".env.*", "!.env.example", ".env.deploy", ".vercel", ".DS_Store"];

function ensureGitignore(dir) {
  const file = path.join(dir, ".gitignore");
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const have = new Set(cur.split(/\r?\n/).map((s) => s.trim()));
  const add = BASE_IGNORES.filter((x) => !have.has(x));
  if (add.length) {
    fs.writeFileSync(file, cur + (cur && !cur.endsWith("\n") ? "\n" : "") + add.join("\n") + "\n");
    log(`Updated .gitignore: ${add.join(" ")}`);
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const dir = path.resolve(opts.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`folder not found: ${dir}`, 64);

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) fail(`Node.js 18 or newer is required (you have ${process.versions.node})`, 3, "Download the LTS from https://nodejs.org.");

  // ---- 1. environment and tokens
  step("1. Checking environment and tokens");
  loadEnvFile(path.join(dir, ".env.deploy"));
  loadEnvFile(path.join(os.homedir(), ".env.deploy"));
  if (!process.env.GITHUB_TOKEN && process.env.GH_TOKEN) process.env.GITHUB_TOKEN = process.env.GH_TOKEN;
  if (!process.env.GITHUB_TOKEN) {
    const t = run("gh", ["auth", "token"], { allowFail: true });
    if (t.ok && t.out) { process.env.GITHUB_TOKEN = t.out; log("GitHub token: from the signed-in gh CLI"); }
  }
  const gitv = run("git", ["--version"]).out;
  log(`${gitv} / Node ${process.versions.node} / ${process.platform}`);

  const missing = [];
  if (!process.env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN  →  https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy");
  if (!process.env.VERCEL_TOKEN) missing.push("VERCEL_TOKEN  →  https://vercel.com/account/tokens");
  if (missing.length) {
    fail("Missing tokens:\n  " + missing.join("\n  "), 2,
      "Open the links above to create the tokens, then put them in .env.deploy in the project (added to .gitignore automatically) or ~/.env.deploy:\n" +
      "  GITHUB_TOKEN=...\n  VERCEL_TOKEN=...\nNever paste tokens into a chat.");
  }

  // ---- 2. accounts
  step("2. Checking accounts");
  const ghUser = await gh("GET", "/user");
  if (ghUser.status === 401) fail("GITHUB_TOKEN is invalid or expired", 2, "Create a new token with the repo scope.");
  if (ghUser.status !== 200) fail(`GitHub /user returned ${ghUser.status}: ${JSON.stringify(ghUser.data)}`);
  const login = ghUser.data.login;
  log(`GitHub: ${login}`);

  const vcUser = await vc("GET", "/v2/user");
  if (vcUser.status === 401 || vcUser.status === 403) fail("VERCEL_TOKEN is invalid or expired", 2, "Create a new one at https://vercel.com/account/tokens.");
  if (vcUser.status !== 200) fail(`Vercel /v2/user returned ${vcUser.status}: ${vcErr(vcUser.data)}`);
  log(`Vercel: ${vcUser.data.user?.username || vcUser.data.user?.email}`);

  let teamQ = "";
  if (opts.team) {
    const t = await vc("GET", `/v2/teams/${encodeURIComponent(opts.team)}`);
    if (t.status !== 200) fail(`Vercel team not found: ${opts.team}: ${vcErr(t.data)}`);
    teamQ = `teamId=${t.data.id}`;
    log(`Vercel team: ${t.data.slug}`);
  } else if (vcUser.data.user?.defaultTeamId) {
    teamQ = `teamId=${vcUser.data.user.defaultTeamId}`;
  }
  const q = (p) => (teamQ ? `${p}${p.includes("?") ? "&" : "?"}${teamQ}` : p);

  const name = (opts.name || path.basename(dir)).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  if (!name) fail("Couldn't derive a repo name from the folder; pass --name", 64);
  const fullName = `${login}/${name}`;

  let repo = await gh("GET", `/repos/${fullName}`);
  const repoExists = repo.status === 200;
  log(`Repo ${fullName}: ${repoExists ? "exists" : "doesn't exist, will create"}`);

  const proj = await vc("GET", q(`/v9/projects/${encodeURIComponent(name)}`));
  const projExists = proj.status === 200;
  log(`Vercel project ${name}: ${projExists ? "exists" : "doesn't exist, will create"}`);

  if (opts.check) {
    Object.assign(result, { ok: true, check: true, github: login, repo: fullName, repoExists, projectExists: projExists });
    log("\nChecks passed. Nothing was changed.");
    return;
  }

  // ---- 3. local repo
  step("3. Preparing the local repo");
  ensureGitignore(dir);
  const g = (args, o = {}) => run("git", args, { cwd: dir, ...o });
  if (!fs.existsSync(path.join(dir, ".git"))) {
    if (!g(["init", "-b", "main"], { allowFail: true }).ok) { g(["init"]); g(["checkout", "-b", "main"]); }
    log("Initialized a git repository");
  }
  let branch = opts.branch || g(["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true }).out;
  if (!branch || branch === "HEAD") branch = "main";

  if (!g(["config", "user.email"], { allowFail: true }).out) {
    g(["config", "user.email", `${ghUser.data.id}+${login}@users.noreply.github.com`]);
    g(["config", "user.name", ghUser.data.name || login]);
  }

  const files = g(["ls-files", "--cached", "--others", "--exclude-standard"]).out.split(/\r?\n/).filter(Boolean);
  if (!files.length) fail("Nothing to commit in this folder", 64);
  const secrets = opts.allowSecrets ? [] : scanSecrets(dir, files);
  if (secrets.length) {
    fail("Possible secrets found; stopped (nothing was pushed):\n  " + secrets.join("\n  "), 5,
      "Add these files to .gitignore or remove the keys, then retry. If it's a false positive, use --allow-secrets.");
  }

  g(["add", "-A"]);
  if (!g(["diff", "--cached", "--quiet"], { allowFail: true }).ok) {
    g(["commit", "-m", opts.message || "Deploy via github-vercel-deploy"]);
    log("Committed changes");
  } else if (!g(["rev-parse", "HEAD"], { allowFail: true }).ok) {
    fail("No commits", 64);
  } else {
    log("No new changes");
  }

  // ---- 4. GitHub
  step("4. GitHub repo");
  if (!repoExists) {
    if (!(await confirm(`Create the ${opts.public ? "public" : "private"} repo ${fullName} and push?`))) fail("Cancelled", 10);
    repo = await gh("POST", "/user/repos", { name, private: !opts.public, auto_init: false });
    if (repo.status !== 201) {
      fail(`Creating the repo failed (${repo.status}): ${repo.data.message || JSON.stringify(repo.data)}`, 1,
        repo.status === 403 || repo.status === 404
          ? "The token can't create repos. Classic tokens need the repo scope; fine-grained tokens need Administration: Read and write. Or create an empty repo at https://github.com/new first and re-run."
          : undefined);
    }
    log(`Created ${repo.data.html_url}`);
  }

  const remoteUrl = process.env.SKILL_DEPLOY_GIT_REMOTE || `https://github.com/${fullName}.git`;
  const cur = g(["remote", "get-url", "origin"], { allowFail: true });
  if (!cur.ok) g(["remote", "add", "origin", remoteUrl]);
  else if (cur.out.replace(/\.git$/, "") !== remoteUrl.replace(/\.git$/, "")) {
    fail(`origin already points to ${cur.out}, not ${remoteUrl}`, 1, "Decide which repo to deploy: use --name, or run git remote set-url origin yourself.");
  }

  // The token reaches git through the environment: never in the remote URL or on the command line
  const basic = Buffer.from(`x-access-token:${process.env.GITHUB_TOKEN}`).toString("base64");
  const push = g(["push", "-u", "origin", `HEAD:refs/heads/${branch}`], {
    allowFail: true,
    env: {
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
      GIT_CONFIG_KEY_1: "credential.helper",
      GIT_CONFIG_VALUE_1: "",
    },
  });
  if (!push.ok) {
    fail(`Push failed:\n${push.err}`, 1,
      /rejected|non-fast-forward/.test(push.err)
        ? "The remote branch has commits you don't have. Run git pull --rebase origin " + branch + " and retry (don't use --force)."
        : "Make sure the token can write to this repo.");
  }
  log(`Pushed to ${fullName}@${branch}`);

  // ---- 5. Vercel
  step("5. Vercel project");
  const linkHint =
    "Vercel can't see this GitHub repo. Check, in order:\n" +
    `  1) The GitHub account linked in Vercel must be ${login}: https://vercel.com/account/settings/authentication\n` +
    "     (common trap: Vercel is linked to a different GitHub account. Disconnect it there and connect the right one)\n" +
    `  2) Vercel's GitHub App must have access to ${fullName}: https://github.com/apps/vercel/installations/new\n` +
    "  Then re-run this script (finished steps are skipped).";

  let project = proj.data;
  if (!projExists) {
    const body = { name, gitRepository: { type: "github", repo: fullName } };
    if (opts.framework) body.framework = opts.framework;
    const c = await vc("POST", q("/v11/projects"), body);
    if (c.status !== 200 && c.status !== 201) {
      const msg = vcErr(c.data);
      fail(`Creating the Vercel project failed (${c.status}): ${msg}`, 6,
        /git|repo|integration|install|namespace|not found/i.test(msg) ? linkHint : undefined);
    }
    project = c.data;
    log(`Created Vercel project ${project.name}`);
  } else if (!project.link || project.link.repo !== name || (project.link.org && project.link.org !== login)) {
    const l = await vc("POST", q(`/v9/projects/${project.id}/link`), { type: "github", repo: fullName });
    if (l.status !== 200) fail(`Linking the repo failed (${l.status}): ${vcErr(l.data)}`, 6, linkHint);
    log(`Linked the Vercel project to ${fullName}`);
  } else {
    log("The Vercel project is already linked to this repo");
  }

  // ---- 6. deploy
  step("6. Deploying to production");
  const d = await vc("POST", q("/v13/deployments"), {
    name, project: project.id, target: "production",
    gitSource: { type: "github", repoId: String(repo.data.id), ref: branch },
  });
  if (d.status !== 200 && d.status !== 201) {
    const msg = vcErr(d.data);
    fail(`Starting the deploy failed (${d.status}): ${msg}`, 7, /git|repo|integration/i.test(msg) ? linkHint : undefined);
  }
  let dep = d.data;
  log(`Deploying: https://${dep.url}`);

  const deadline = Date.now() + 15 * 60_000;
  while (!["READY", "ERROR", "CANCELED"].includes(dep.readyState)) {
    if (Date.now() > deadline) fail("The deploy took longer than 15 minutes", 7, `Check progress at ${dep.inspectorUrl || "the Vercel dashboard"}.`);
    await sleep(Number(process.env.SKILL_DEPLOY_POLL_MS || 5000));
    const s = await vc("GET", q(`/v13/deployments/${dep.id}`));
    if (s.status === 200) { dep = s.data; log(`  status: ${dep.readyState}`); }
  }
  if (dep.readyState !== "READY") {
    fail(`Deploy failed: ${dep.readyState}`, 7, `Build log: ${dep.inspectorUrl || `https://vercel.com/${project.accountId}/${name}`}\nFix the code and re-run.`);
  }

  const p2 = await vc("GET", q(`/v9/projects/${project.id}`));
  const prodAlias = p2.data?.targets?.production?.alias?.[0] || dep.alias?.[0] || `${name}.vercel.app`;
  const prodUrl = `https://${prodAlias}`;

  // ---- 7. verify
  step("7. Verifying");
  let httpStatus = null;
  try { httpStatus = (await fetch(prodUrl, { method: "GET", redirect: "follow" })).status; } catch {}
  log(`${prodUrl} → HTTP ${httpStatus ?? "unreachable (may need a few seconds, or Vercel Deployment Protection is on)"}`);

  Object.assign(result, {
    ok: true, github: login, repo: repo.data.html_url || `https://github.com/${fullName}`,
    branch, project: name, deployment: `https://${dep.url}`, url: prodUrl, httpStatus,
  });
  log(`\nDone!\n  Repo:   ${result.repo}\n  Site:   ${prodUrl}\nEvery git push to ${branch} now deploys automatically; other branches get preview links.`);
}

main()
  .catch((e) => {
    result.ok = false;
    result.error = e.message;
    if (e.hint) result.hint = e.hint;
    console.error(`\n✖ ${e.message}`);
    if (e.hint) console.error(`\n${e.hint}`);
    if (!(e instanceof DeployError)) console.error(e.stack);
    process.exitCode = e.code || 1;
  })
  .finally(() => {
    if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });
