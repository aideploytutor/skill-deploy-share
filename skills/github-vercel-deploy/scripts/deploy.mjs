#!/usr/bin/env node
/**
 * github-vercel-deploy — 把一个本地文件夹推到 GitHub，并在 Vercel 上建项目、连接仓库、部署上线。
 *
 * 只依赖 git + Node.js 18+，通过 GitHub / Vercel 的 REST API 完成所有操作：
 *   - 不需要 gh、vercel CLI（避免 Windows 装完不在 PATH 的问题）
 *   - 不会弹出交互式登录（避免卡在 "Waiting for authentication..."）
 *   - 能检测 Vercel 绑定的 GitHub 账号和仓库所有者不一致的问题
 *
 * 用法：
 *   node deploy.mjs --check                    只做检查，不改任何东西
 *   node deploy.mjs --dir ./my-app --yes       部署（私有仓库）
 *   node deploy.mjs --dir ./my-app --public    部署（公开仓库）
 *   node deploy.mjs --help
 *
 * 需要两个令牌（只放环境变量或 .env.deploy，不要贴到聊天里）：
 *   GITHUB_TOKEN  https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy
 *   VERCEL_TOKEN  https://vercel.com/account/tokens
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

// ---------------------------------------------------------------- 参数

const HELP = `用法: node deploy.mjs [选项]

  --dir <路径>        项目文件夹（默认当前目录）
  --name <仓库名>     GitHub 仓库名 / Vercel 项目名（默认取文件夹名）
  --public            创建公开仓库（默认私有）
  --branch <分支>     部署分支（默认当前分支或 main）
  --team <slug|id>    Vercel 团队（默认个人账号）
  --framework <名称>  Vercel 框架预设，如 nextjs、vite（默认自动识别）
  --message <文字>    提交说明（默认 "Deploy via github-vercel-deploy"）
  --yes               不再询问，直接执行（给 Agent / CI 用）
  --check             只检查环境和账号，不做任何改动
  --allow-secrets     跳过密钥扫描（不推荐）
  --json              最后输出 JSON 结果（给程序调用）
  --help              显示帮助

令牌（环境变量，或项目下 / 用户目录下的 .env.deploy 文件）：
  GITHUB_TOKEN（或 GH_TOKEN）  需要 repo 权限
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
      if (v === undefined) usageError(`${a} 需要一个值`);
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
      default: usageError(`未知参数: ${a}（用 --help 查看用法）`);
    }
  }
  return o;
}

// ---------------------------------------------------------------- 输出

const opts = parseArgs(process.argv.slice(2));
const result = { ok: false, steps: [] };
const log = (...m) => { if (!opts.json) console.log(...m); else console.error(...m); };
const step = (t) => { result.steps.push(t); log(`\n== ${t} ==`); };

class DeployError extends Error {
  constructor(msg, code = 1, hint) { super(msg); this.code = code; this.hint = hint; }
}
function fail(msg, code = 1, hint) { throw new DeployError(msg, code, hint); }

// ---------------------------------------------------------------- 工具函数

function run(cmd, args, { cwd, env, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, env: { ...process.env, ...env }, encoding: "utf8",
    shell: false, windowsHide: true,
  });
  if (r.error && r.error.code === "ENOENT") {
    if (allowFail) return { ok: false, out: "", err: "ENOENT" };
    fail(`找不到命令: ${cmd}`, 3, installHint(cmd));
  }
  const ok = r.status === 0;
  if (!ok && !allowFail) {
    fail(`${cmd} ${args.join(" ")} 失败:\n${(r.stderr || r.stdout || "").trim()}`);
  }
  return { ok, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function installHint(cmd) {
  const p = process.platform;
  if (cmd === "git") {
    if (p === "win32") return "安装: winget install --id Git.Git -e   （装完后新开一个终端再运行）";
    if (p === "darwin") return "安装: xcode-select --install   或   brew install git";
    return "安装: sudo apt install git   （或你系统的包管理器）";
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
    fail(`需要确认: ${question}`, 10,
      "当前不是交互终端。确认后加 --yes 重新运行（Agent：先问用户，用户同意后再加 --yes）。");
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
    fail(`无法连接 ${base}: ${e.cause?.code || e.message}`, 4, "检查网络或代理设置。");
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}
const gh = (m, p, b) => api(GH_API, process.env.GITHUB_TOKEN, m, p, b);
const vc = (m, p, b) => api(VC_API, process.env.VERCEL_TOKEN, m, p, b);
const vcErr = (d) => d?.error?.message || d?.message || JSON.stringify(d);

// ---------------------------------------------------------------- 密钥扫描

const SECRET_NAME = /(^|\/)(\.env(\.(?!example$|sample$|template$)[^/]*)?|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa[^/]*|id_ed25519[^/]*|credentials[^/]*\.json|service-account[^/]*\.json|\.npmrc|\.env\.deploy)$/i;
const SECRET_BODY = [
  /ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{40,}/, /\bsk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

function scanSecrets(dir, files) {
  const hits = [];
  for (const f of files) {
    if (SECRET_NAME.test(f)) { hits.push(`${f}（文件名像密钥文件）`); continue; }
    const full = path.join(dir, f);
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile() || st.size > 1_000_000) continue;
    const body = fs.readFileSync(full, "utf8");
    if (body.includes("\u0000")) continue; // 二进制
    if (SECRET_BODY.some((re) => re.test(body))) hits.push(`${f}（内容里有疑似令牌/私钥）`);
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
    log(`已更新 .gitignore: ${add.join(" ")}`);
  }
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const dir = path.resolve(opts.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`文件夹不存在: ${dir}`, 64);

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) fail(`需要 Node.js 18 或更高版本（当前 ${process.versions.node}）`, 3, "到 https://nodejs.org 下载 LTS 版本。");

  // ---- 1. 环境与令牌
  step("1. 检查环境与令牌");
  loadEnvFile(path.join(dir, ".env.deploy"));
  loadEnvFile(path.join(os.homedir(), ".env.deploy"));
  if (!process.env.GITHUB_TOKEN && process.env.GH_TOKEN) process.env.GITHUB_TOKEN = process.env.GH_TOKEN;
  if (!process.env.GITHUB_TOKEN) {
    const t = run("gh", ["auth", "token"], { allowFail: true });
    if (t.ok && t.out) { process.env.GITHUB_TOKEN = t.out; log("GitHub 令牌：来自已登录的 gh CLI"); }
  }
  const gitv = run("git", ["--version"]).out;
  log(`${gitv} / Node ${process.versions.node} / ${process.platform}`);

  const missing = [];
  if (!process.env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN  →  https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy");
  if (!process.env.VERCEL_TOKEN) missing.push("VERCEL_TOKEN  →  https://vercel.com/account/tokens");
  if (missing.length) {
    fail("缺少令牌:\n  " + missing.join("\n  "), 2,
      "在浏览器打开上面的链接生成令牌，然后写进项目里的 .env.deploy（会自动加入 .gitignore）或用户目录下的 ~/.env.deploy：\n" +
      "  GITHUB_TOKEN=...\n  VERCEL_TOKEN=...\n不要把令牌贴到聊天里。");
  }

  // ---- 2. 账号
  step("2. 确认账号");
  const ghUser = await gh("GET", "/user");
  if (ghUser.status === 401) fail("GITHUB_TOKEN 无效或已过期", 2, "重新生成一个带 repo 权限的令牌。");
  if (ghUser.status !== 200) fail(`GitHub /user 返回 ${ghUser.status}: ${JSON.stringify(ghUser.data)}`);
  const login = ghUser.data.login;
  log(`GitHub: ${login}`);

  const vcUser = await vc("GET", "/v2/user");
  if (vcUser.status === 401 || vcUser.status === 403) fail("VERCEL_TOKEN 无效或已过期", 2, "到 https://vercel.com/account/tokens 重新生成。");
  if (vcUser.status !== 200) fail(`Vercel /v2/user 返回 ${vcUser.status}: ${vcErr(vcUser.data)}`);
  log(`Vercel: ${vcUser.data.user?.username || vcUser.data.user?.email}`);

  let teamQ = "";
  if (opts.team) {
    const t = await vc("GET", `/v2/teams/${encodeURIComponent(opts.team)}`);
    if (t.status !== 200) fail(`找不到 Vercel 团队 ${opts.team}: ${vcErr(t.data)}`);
    teamQ = `teamId=${t.data.id}`;
    log(`Vercel 团队: ${t.data.slug}`);
  } else if (vcUser.data.user?.defaultTeamId) {
    teamQ = `teamId=${vcUser.data.user.defaultTeamId}`;
  }
  const q = (p) => (teamQ ? `${p}${p.includes("?") ? "&" : "?"}${teamQ}` : p);

  const name = (opts.name || path.basename(dir)).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  if (!name) fail("无法从文件夹名推断仓库名，请用 --name 指定", 64);
  const fullName = `${login}/${name}`;

  let repo = await gh("GET", `/repos/${fullName}`);
  const repoExists = repo.status === 200;
  log(`仓库 ${fullName}: ${repoExists ? "已存在" : "不存在，将创建"}`);

  const proj = await vc("GET", q(`/v9/projects/${encodeURIComponent(name)}`));
  const projExists = proj.status === 200;
  log(`Vercel 项目 ${name}: ${projExists ? "已存在" : "不存在，将创建"}`);

  if (opts.check) {
    Object.assign(result, { ok: true, check: true, github: login, repo: fullName, repoExists, projectExists: projExists });
    log("\n检查通过，没有做任何改动。");
    return;
  }

  // ---- 3. 本地仓库
  step("3. 准备本地仓库");
  ensureGitignore(dir);
  const g = (args, o = {}) => run("git", args, { cwd: dir, ...o });
  if (!fs.existsSync(path.join(dir, ".git"))) {
    if (!g(["init", "-b", "main"], { allowFail: true }).ok) { g(["init"]); g(["checkout", "-b", "main"]); }
    log("已初始化 git 仓库");
  }
  let branch = opts.branch || g(["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true }).out;
  if (!branch || branch === "HEAD") branch = "main";

  if (!g(["config", "user.email"], { allowFail: true }).out) {
    g(["config", "user.email", `${ghUser.data.id}+${login}@users.noreply.github.com`]);
    g(["config", "user.name", ghUser.data.name || login]);
  }

  const files = g(["ls-files", "--cached", "--others", "--exclude-standard"]).out.split(/\r?\n/).filter(Boolean);
  if (!files.length) fail("文件夹里没有可提交的文件", 64);
  const secrets = opts.allowSecrets ? [] : scanSecrets(dir, files);
  if (secrets.length) {
    fail("发现疑似密钥，已停止（没有推送任何东西）:\n  " + secrets.join("\n  "), 5,
      "把这些文件加进 .gitignore 或删掉里面的密钥后重试。确认是误报可加 --allow-secrets。");
  }

  g(["add", "-A"]);
  if (!g(["diff", "--cached", "--quiet"], { allowFail: true }).ok) {
    g(["commit", "-m", opts.message || "Deploy via github-vercel-deploy"]);
    log("已提交改动");
  } else if (!g(["rev-parse", "HEAD"], { allowFail: true }).ok) {
    fail("没有任何提交", 64);
  } else {
    log("没有新改动");
  }

  // ---- 4. GitHub
  step("4. GitHub 仓库");
  if (!repoExists) {
    if (!(await confirm(`创建${opts.public ? "公开" : "私有"}仓库 ${fullName} 并推送？`))) fail("已取消", 10);
    repo = await gh("POST", "/user/repos", { name, private: !opts.public, auto_init: false });
    if (repo.status !== 201) {
      fail(`创建仓库失败 (${repo.status}): ${repo.data.message || JSON.stringify(repo.data)}`, 1,
        repo.status === 403 || repo.status === 404
          ? "令牌没有创建仓库的权限。经典令牌需要勾选 repo；细粒度令牌需要 Administration: Read and write。也可以先在 https://github.com/new 手动建好空仓库再运行。"
          : undefined);
    }
    log(`已创建 ${repo.data.html_url}`);
  }

  const remoteUrl = process.env.SKILL_DEPLOY_GIT_REMOTE || `https://github.com/${fullName}.git`;
  const cur = g(["remote", "get-url", "origin"], { allowFail: true });
  if (!cur.ok) g(["remote", "add", "origin", remoteUrl]);
  else if (cur.out.replace(/\.git$/, "") !== remoteUrl.replace(/\.git$/, "")) {
    fail(`origin 已指向 ${cur.out}，与 ${remoteUrl} 不同`, 1, "确认要部署哪个仓库：改用 --name，或手动 git remote set-url origin。");
  }

  // 令牌通过环境变量传给 git，不写进 remote URL、不出现在命令行参数里
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
    fail(`推送失败:\n${push.err}`, 1,
      /rejected|non-fast-forward/.test(push.err)
        ? "远程分支有本地没有的提交。先 git pull --rebase origin " + branch + " 再重试（不要用 --force）。"
        : "确认令牌有该仓库的写权限。");
  }
  log(`已推送到 ${fullName}@${branch}`);

  // ---- 5. Vercel
  step("5. Vercel 项目");
  const linkHint =
    "Vercel 看不到这个 GitHub 仓库。按顺序检查：\n" +
    `  1) Vercel 登录方式里绑定的 GitHub 账号必须是 ${login}：https://vercel.com/account/settings/authentication\n` +
    "     （常见坑：Vercel 绑的是另一个 GitHub 账号。在那里 Disconnect 后重新 Connect 正确账号）\n" +
    `  2) Vercel 的 GitHub App 要能访问 ${fullName}：https://github.com/apps/vercel/installations/new\n` +
    "  改完后重新运行本脚本即可（已完成的步骤会自动跳过）。";

  let project = proj.data;
  if (!projExists) {
    const body = { name, gitRepository: { type: "github", repo: fullName } };
    if (opts.framework) body.framework = opts.framework;
    const c = await vc("POST", q("/v11/projects"), body);
    if (c.status !== 200 && c.status !== 201) {
      const msg = vcErr(c.data);
      fail(`创建 Vercel 项目失败 (${c.status}): ${msg}`, 6,
        /git|repo|integration|install|namespace|not found/i.test(msg) ? linkHint : undefined);
    }
    project = c.data;
    log(`已创建 Vercel 项目 ${project.name}`);
  } else if (!project.link || project.link.repo !== name || (project.link.org && project.link.org !== login)) {
    const l = await vc("POST", q(`/v9/projects/${project.id}/link`), { type: "github", repo: fullName });
    if (l.status !== 200) fail(`连接仓库失败 (${l.status}): ${vcErr(l.data)}`, 6, linkHint);
    log(`已把 Vercel 项目连接到 ${fullName}`);
  } else {
    log("Vercel 项目已连接该仓库");
  }

  // ---- 6. 部署
  step("6. 部署到生产环境");
  const d = await vc("POST", q("/v13/deployments"), {
    name, project: project.id, target: "production",
    gitSource: { type: "github", repoId: String(repo.data.id), ref: branch },
  });
  if (d.status !== 200 && d.status !== 201) {
    const msg = vcErr(d.data);
    fail(`触发部署失败 (${d.status}): ${msg}`, 7, /git|repo|integration/i.test(msg) ? linkHint : undefined);
  }
  let dep = d.data;
  log(`部署中: https://${dep.url}`);

  const deadline = Date.now() + 15 * 60_000;
  while (!["READY", "ERROR", "CANCELED"].includes(dep.readyState)) {
    if (Date.now() > deadline) fail("等待部署超过 15 分钟", 7, `在 ${dep.inspectorUrl || "Vercel 控制台"} 查看进度。`);
    await sleep(Number(process.env.SKILL_DEPLOY_POLL_MS || 5000));
    const s = await vc("GET", q(`/v13/deployments/${dep.id}`));
    if (s.status === 200) { dep = s.data; log(`  状态: ${dep.readyState}`); }
  }
  if (dep.readyState !== "READY") {
    fail(`部署失败: ${dep.readyState}`, 7, `构建日志: ${dep.inspectorUrl || `https://vercel.com/${project.accountId}/${name}`}\n修好代码后重新运行即可。`);
  }

  const p2 = await vc("GET", q(`/v9/projects/${project.id}`));
  const prodAlias = p2.data?.targets?.production?.alias?.[0] || dep.alias?.[0] || `${name}.vercel.app`;
  const prodUrl = `https://${prodAlias}`;

  // ---- 7. 验证
  step("7. 验证");
  let httpStatus = null;
  try { httpStatus = (await fetch(prodUrl, { method: "GET", redirect: "follow" })).status; } catch {}
  log(`${prodUrl} → HTTP ${httpStatus ?? "无法访问（可能需要几秒生效，或开启了 Vercel 访问保护）"}`);

  Object.assign(result, {
    ok: true, github: login, repo: repo.data.html_url || `https://github.com/${fullName}`,
    branch, project: name, deployment: `https://${dep.url}`, url: prodUrl, httpStatus,
  });
  log(`\n完成！\n  仓库:   ${result.repo}\n  网站:   ${prodUrl}\n以后 git push 到 ${branch} 会自动部署；其他分支会生成预览链接。`);
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
