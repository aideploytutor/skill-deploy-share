#!/usr/bin/env node
/**
 * deploy-cloudflare — make an app-foundation project run on Cloudflare Workers
 * (free plan allows commercial use), next to or instead of Vercel.
 *
 *   node apply.mjs --dir ./my-shop            patch the project (safe to run twice)
 *   node apply.mjs --dir ./my-shop --check    show what would change, change nothing
 *   node apply.mjs ... --json                 machine-readable result (includes the variable checklist)
 *   node apply.mjs ... --no-git               don't commit
 *   node apply.mjs ... --hyperdrive <id>      bind a Hyperdrive config (fast pooled database connections)
 *
 * Adds wrangler.jsonc, open-next.config.ts, public/_headers, the @opennextjs/cloudflare and
 * wrangler packages and cf:* scripts, makes the database client safe for Workers, ignores
 * .open-next/, records the install and commits. Vercel keeps working from the same code.
 * Prints which variables to re-create in Cloudflare (names only; it never reads values).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const OPENNEXT = "^1.20.8";
const WRANGLER = "^4.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
// app-foundation's database client before it learned about Workers. Replaced only if untouched.
const DB_PREVIOUS = [
  "2ed016add06c936c4ab58a1952bff822401e68557a63320030506cbd3bca53cd", // app-foundation 1.0.x
  "c1094aa705bc237996ba3c7933b12bdcb0ab71e2b147b1257ee5901f1aa88d7e", // app-foundation 1.1.0 (Workers-safe, no Hyperdrive)
];

const opts = { json: false, check: false, git: true };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") opts.dir = argv[++i];
  else if (a === "--check") opts.check = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--no-git") opts.git = false;
  else if (a === "--hyperdrive") opts.hyperdrive = argv[++i];
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}

const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const result = { ok: false, skill: "deploy-cloudflare", version: VERSION, changed: [], skipped: [], warnings: [], manual: [], variables: [] };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function write(dir, rel, content) {
  if (!opts.check) {
    const to = path.join(dir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}

/** Variable names from .env.example (commented or not), with where each must go on Cloudflare. */
function variableChecklist(dir) {
  const p = path.join(dir, ".env.example");
  if (!fs.existsSync(p)) return [];
  const seen = new Map();
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})=/);
    if (!m || seen.has(m[1])) continue;
    const name = m[1];
    if (name === "DATABASE_URL_UNPOOLED") continue; // migrations fall back to DATABASE_URL
    const secret = /SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL|_CODE$/.test(name);
    const build = name.startsWith("NEXT_PUBLIC_") || name === "DATABASE_URL"; // inlined at build / used by db-migrate
    seen.set(name, { name, type: secret ? "secret" : "text", alsoBuildVariable: build });
  }
  return [...seen.values()];
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["app-foundation"]) throw Object.assign(new Error("stack.json does not list app-foundation"), { code: 3 });

  const pkgPath = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const name = String(pkg.name || path.basename(dir)).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 54) || "my-site";

  // 1. Config files (never overwrite the owner's own)
  for (const rel of ["open-next.config.ts", "public/_headers"]) {
    const to = path.join(dir, rel);
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    if (!fs.existsSync(to)) write(dir, rel, src);
    else if (fs.readFileSync(to, "utf8") !== src) result.skipped.push(`${rel} (exists, kept yours)`);
  }
  const wr = path.join(dir, "wrangler.jsonc");
  if (!fs.existsSync(wr) && !fs.existsSync(path.join(dir, "wrangler.toml")) && !fs.existsSync(path.join(dir, "wrangler.json"))) {
    write(dir, "wrangler.jsonc", fs.readFileSync(path.join(FILES, "wrangler.jsonc"), "utf8").replaceAll("__NAME__", name));
  } else if (!fs.existsSync(wr) || !fs.readFileSync(wr, "utf8").includes('"main": ".open-next/worker.js"')) {
    result.skipped.push("wrangler config (exists, kept yours: check that main is .open-next/worker.js and nodejs_compat is on)");
  }
  if (opts.hyperdrive) {
    if (!/^[0-9a-f]{32}$/.test(opts.hyperdrive)) throw Object.assign(new Error("--hyperdrive expects the 32-character Hyperdrive ID"), { code: 64 });
    const wf = fs.existsSync(wr) ? wr : null;
    const cur = wf ? fs.readFileSync(wf, "utf8") : opts.check ? "" : null;
    if (wf && !/"hyperdrive"/.test(cur)) {
      write(dir, "wrangler.jsonc", cur.replace(/\n\}\s*$/, `,\n  // Pooled database connections (free plan: 100,000 queries a day). The ID is not a secret;\n  // localConnectionString is a placeholder the deploy tool requires (only used by local dev).\n  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "${opts.hyperdrive}", "localConnectionString": "postgres://user:password@localhost:5432/dev" }]\n}\n`));
    } else if (wf) result.skipped.push("wrangler.jsonc already has a hyperdrive binding");
  }

  // 2. Database client that works on Workers
  const dbRel = "src/db/index.ts";
  const dbTo = path.join(dir, dbRel);
  const dbSrc = fs.readFileSync(path.join(FILES, dbRel), "utf8");
  if (fs.existsSync(dbTo) && fs.readFileSync(dbTo, "utf8") !== dbSrc) {
    if (DB_PREVIOUS.includes(sha(dbTo))) write(dir, dbRel, dbSrc);
    else result.manual.push(`${dbRel}: you changed this file. On Workers, create the Postgres client per request (see ${path.join(FILES, dbRel)}), or requests after the first will fail.`);
  }

  // 3. next.config: keep the postgres driver unbundled so Workers load its "workerd" build
  //    (bundled, Next.js picks the Node build and connections time out with CONNECT_TIMEOUT).
  const ncRel = ["next.config.ts", "next.config.mjs", "next.config.js"].find((f) => fs.existsSync(path.join(dir, f)));
  if (ncRel) {
    const nc = fs.readFileSync(path.join(dir, ncRel), "utf8");
    if (!/serverExternalPackages/.test(nc)) {
      const next = nc.replace(/(const nextConfig[^=]*=\s*\{\n)/, '$1  // Load the database driver unbundled, so Cloudflare Workers get its Workers build\n  // (deploy-cloudflare, episode 009). Harmless on Vercel.\n  serverExternalPackages: ["postgres"],\n');
      if (next !== nc) write(dir, ncRel, next);
      else result.manual.push(`${ncRel}: add serverExternalPackages: ["postgres"] to the Next.js config`);
    } else if (!/["']postgres["']/.test(nc)) {
      result.manual.push(`${ncRel}: add "postgres" to serverExternalPackages`);
    }
  } else result.manual.push('No next.config found: create one with serverExternalPackages: ["postgres"]');

  // 3a. auth-login keeps one Better Auth instance (holding a DB connection) forever; on Workers
  //     that breaks the second request ("Failed to get session"). Make it per request.
  const authRel = "src/lib/auth.ts";
  const authTo = path.join(dir, authRel);
  if (fs.existsSync(authTo)) {
    const a = fs.readFileSync(authTo, "utf8");
    const oldGet = "export function getAuth() {\n  if (!cached) cached = createAuth();\n  return cached;\n}";
    if (a.includes(oldGet)) {
      let next = a.replace(oldGet,
        "// Cloudflare Workers can't reuse a database connection across requests, so there the\n" +
        "// auth instance (which holds one) is made per request. Elsewhere one instance is kept.\n" +
        'const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";\n' +
        "const perRequest = cache(createAuth);\n\n" +
        "export function getAuth() {\n  if (onWorkers) return perRequest();\n  return (cached ??= createAuth());\n}");
      if (!/from "react"/.test(next)) next = 'import { cache } from "react";\n' + next;
      write(dir, authRel, next);
    } else if (!/onWorkers/.test(a) && /getAuth/.test(a)) {
      result.manual.push(`${authRel}: create the Better Auth instance per request on Workers (see auth-login 1.1.1), or sign-in fails after the first request`);
    }
  }

  // 3b. Runtime label on /status (cosmetic)
  const statusRel = "src/app/status/page.tsx";
  const statusTo = path.join(dir, statusRel);
  if (fs.existsSync(statusTo)) {
    const s = fs.readFileSync(statusTo, "utf8");
    const next = s.replace("process.env.CF_PAGES || process.env.CLOUDFLARE", '(typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")');
    if (next !== s) write(dir, statusRel, next);
  }

  // 4. Packages and scripts
  let pkgChanged = false;
  if (!pkg.dependencies?.["@opennextjs/cloudflare"]) {
    pkg.dependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, "@opennextjs/cloudflare": OPENNEXT }).sort(([a], [b]) => a.localeCompare(b)));
    pkgChanged = true;
  }
  if (!pkg.devDependencies?.wrangler) {
    pkg.devDependencies = Object.fromEntries(Object.entries({ ...pkg.devDependencies, wrangler: WRANGLER }).sort(([a], [b]) => a.localeCompare(b)));
    pkgChanged = true;
  }
  const scripts = (pkg.scripts ??= {});
  const want = {
    "cf:build": "opennextjs-cloudflare build",
    "cf:preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "cf:deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
  };
  for (const [k, v] of Object.entries(want)) if (scripts[k] !== v) { scripts[k] = v; pkgChanged = true; }
  if (pkgChanged) write(dir, "package.json", JSON.stringify(pkg, null, 2) + "\n");

  // 5. .gitignore
  const giPath = path.join(dir, ".gitignore");
  const gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, "utf8") : "";
  const add = [".open-next/", ".wrangler/", ".dev.vars"].filter((e) => !gi.split(/\r?\n/).some((l) => l.trim() === e || l.trim() === e.replace(/\/$/, "")));
  if (add.length) write(dir, ".gitignore", gi.trimEnd() + "\n\n# deploy-cloudflare (episode 009)\n" + add.join("\n") + "\n");

  // 6. Edge runtime isn't supported by OpenNext
  const edge = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?[jt]sx?)$/.test(e.name) && /export\s+const\s+runtime\s*=\s*["']edge["']/.test(fs.readFileSync(p, "utf8"))) edge.push(path.relative(dir, p));
    }
  };
  if (fs.existsSync(path.join(dir, "src"))) walk(path.join(dir, "src"));
  for (const f of edge) result.warnings.push(`${f} sets runtime = "edge"; remove that line (Cloudflare runs the Node.js runtime).`);

  // 7. Record the install
  if (installed["deploy-cloudflare"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "deploy-cloudflare": VERSION } }, null, 2) + "\n");
  }

  // 8. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add deploy-cloudflare: run on Cloudflare Workers (OpenNext)"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.variables = variableChecklist(dir);
  result.worker = name;
  result.ok = true;
  result.next = [
    "Push. Owner: Cloudflare → Workers & Pages → Create → Import a repository → this repo",
    `Worker name: ${name} · Build command: npx opennextjs-cloudflare build · Deploy command: npx opennextjs-cloudflare deploy`,
    "Owner: add the variables below (Settings → Variables and Secrets; NEXT_PUBLIC_* and DATABASE_URL also under Build → Variables), then retry the build",
    "Open https://<worker>.<account>.workers.dev, then /status, /login, /files",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  for (const s of result.skipped) log("Kept:", s);
  for (const w of result.warnings) log("⚠", w);
  for (const m of result.manual) log("⚠ Needs a hand:", m);
  if (result.variables.length) {
    log("\nVariables to add in Cloudflare (values come from where you made them, never from chat):");
    for (const v of result.variables) log(`  ${v.name.padEnd(24)} ${v.type === "secret" ? "Secret" : "Text"}${v.alsoBuildVariable ? " · also a Build variable" : ""}`);
  }
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  console.error(`✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  process.exitCode = e.code || 1;
} finally {
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
