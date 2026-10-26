#!/usr/bin/env node
/**
 * auth-login — add sign-in (Google + 6-digit email code, via Better Auth) to an app-foundation project.
 *
 *   node apply.mjs --dir ./my-shop            patch the project (safe to run twice)
 *   node apply.mjs --dir ./my-shop --check    show what would change, change nothing
 *   node apply.mjs ... --json                 machine-readable result
 *
 * Adds the auth_* tables, /login, /account and /api/auth/*, the better-auth dependency,
 * documents the variables in .env.example, records the install, and commits.
 * Then generates the database migration if dependencies are installed (npm run db:generate).
 * It never touches secrets: BETTER_AUTH_SECRET and GOOGLE_CLIENT_SECRET are set by the owner in the host's settings.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.1.1";
const BETTER_AUTH = "^1.7.8";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = [
  "src/db/schema/auth.ts",
  "src/lib/auth.ts",
  "src/lib/auth-client.ts",
  "src/app/api/auth/[...all]/route.ts",
  "src/app/login/page.tsx",
  "src/app/login/login-form.tsx",
  "src/app/login/secret-maker.tsx",
  "src/app/account/page.tsx",
  "src/app/account/sign-out.tsx",
  "src/app/privacy/page.tsx",
];

// Earlier versions of our own files: replaced on upgrade only if the owner never edited them.
const PREVIOUS = {
  "src/lib/auth.ts": ["33b62ffb21f70c93d4a62ad17db1cf3414ef4b0eeb1aee600c3706746f9dabb6", "d27b215c6230554b52d8be6c6027a1eb8deaf679bced9a2942e20df43f68e16d"], // 1.0.0, 1.1.0
  "src/app/login/page.tsx": ["b286cb90276ec0de7e56702850f6172d957cc3229da2c00ccac49272018e770d"], // 1.0.0
  "src/app/login/login-form.tsx": ["9d7ba58ef34e06c1c8abb2065ec0d84201351c41dde10528a78d7c9fd4b04977"], // 1.0.0
  "src/app/login/secret-maker.tsx": ["0d11a2886a34bf9174b1a38aa9382e02c1ef77bf20a749d36b4aeed90c5b14c6"], // 1.0.0
  "src/app/account/page.tsx": ["750d0c102bfb00828ef091ac6fcaeebcf7c15201c2cfd09bbcf84b095aa8d45e"], // 1.0.0
  "src/app/account/sign-out.tsx": ["af4b333f2520638ff413a580a0f4ab658c010e0e80c58d6eb3324e52b594d114"], // 1.0.0
  "src/app/privacy/page.tsx": ["60ebe1b80fc487748f27e800c36dff5d943d670423fe5e39fa6c725f1304815e"], // 1.0.0
};

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
const result = { ok: false, skill: "auth-login", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

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
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["app-foundation"]) throw Object.assign(new Error("stack.json does not list app-foundation"), { code: 3 });
  if (!installed["db-connect"]) throw Object.assign(new Error("db-connect is not installed — users have to be stored in a database"), { code: 3, hint: "Install db-connect first (episode 003)." });
  if (!installed["email-send"]) result.warnings.push("email-send is not installed: only Google sign-in will work. For email codes, install email-send (episode 005).");

  // 1. Our files (never overwrite something the owner changed)
  for (const rel of NEW_FILES) {
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    const to = path.join(dir, rel);
    if (!fs.existsSync(to)) write(dir, rel, src);
    else if (fs.readFileSync(to, "utf8") === src) continue;
    else if ((PREVIOUS[rel] || []).includes(sha(to))) write(dir, rel, src);
    else result.skipped.push(`${rel} (exists, kept yours)`);
  }
  if (!fs.existsSync(path.join(dir, "src/lib/email.ts"))) {
    // auth.ts imports sendEmail; give Google-only projects a stub that reports "not configured".
    write(dir, "src/lib/email.ts", 'export function isEmailConfigured() { return false; }\nexport async function sendEmail(_: unknown): Promise<{ ok: false; error: string }> {\n  return { ok: false, error: "Email is not set up (episode 005, email-send)." };\n}\n');
  }

  // 2. Schema index
  const idxPath = path.join(dir, "src/db/schema/index.ts");
  const idx = fs.readFileSync(idxPath, "utf8");
  if (!/from\s+["']\.\/auth["']/.test(idx)) write(dir, "src/db/schema/index.ts", idx.trimEnd() + '\nexport * from "./auth";\n');

  // 3. Dependency
  const pkgPath = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (!pkg.dependencies?.["better-auth"]) {
    pkg.dependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, "better-auth": BETTER_AUTH }).sort(([a], [b]) => a.localeCompare(b)));
    write(dir, "package.json", JSON.stringify(pkg, null, 2) + "\n");
  }

  // 4. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/BETTER_AUTH_SECRET/.test(env)) {
    write(dir, ".env.example", env.trimEnd() +
      "\n\n# auth-login (episode 006) — set these in the host's settings (Cloudflare → Worker → Settings → Variables and Secrets).\n" +
      "# BETTER_AUTH_SECRET=...                (secret: random, 32+ characters; /login can generate one)\n" +
      "# BETTER_AUTH_URL=https://your-domain   (optional; defaults to NEXT_PUBLIC_SITE_URL)\n" +
      "# GOOGLE_CLIENT_ID=...apps.googleusercontent.com\n" +
      "# GOOGLE_CLIENT_SECRET=...              (secret: Google Cloud → Credentials)\n");
  }

  // 5. Record the install
  if (installed["auth-login"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "auth-login": VERSION } }, null, 2) + "\n");
  }

  // 6. Migration for the auth_* tables
  const journal = path.join(dir, "drizzle/meta/_journal.json");
  const hasAuthMigration = fs.existsSync(path.join(dir, "drizzle")) &&
    fs.readdirSync(path.join(dir, "drizzle")).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(dir, "drizzle", f), "utf8").includes('"auth_users"'));
  if (!hasAuthMigration) {
    const kit = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
    if (!opts.check && opts.generate && fs.existsSync(kit) && fs.existsSync(journal)) {
      const g = spawnSync(kit, ["generate", "--name", "auth_login"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
      if (g.status === 0) result.changed.push("drizzle/ (auth_login migration)");
      else result.manual.push(`Generate the migration: npm install && npm run db:generate -- --name auth_login\n${g.stderr || g.stdout}`);
    } else {
      result.manual.push("Generate the migration: npm install, then npm run db:generate -- --name auth_login, and commit the drizzle/ folder");
    }
  }

  // 7. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add auth-login: Google + email code sign-in (Better Auth)"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Owner: open /login after deploying → Generate BETTER_AUTH_SECRET → paste into the host as a Secret",
    "Owner: Google Cloud → OAuth client (Web) with redirect URI https://<domain>/api/auth/callback/google → GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET into the host",
    "Redeploy, open /login, try both ways, then /account",
  ];
  log(opts.check ? "Would change:" : "Changed:", result.changed.length ? result.changed.join(", ") : "nothing");
  for (const s of result.skipped) log("Kept:", s);
  for (const w of result.warnings) log("⚠", w);
  for (const m of result.manual) log("⚠ Needs a hand:", m);
} catch (e) {
  result.error = e.message;
  if (e.hint) result.hint = e.hint;
  console.error(`✖ ${e.message}`);
  if (e.hint) console.error(e.hint);
  process.exitCode = e.code || 1;
} finally {
  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
