#!/usr/bin/env node
/**
 * file-upload — let signed-in users upload images and PDFs to object storage (Vercel Blob).
 *
 *   node apply.mjs --dir ./my-shop            patch the project (safe to run twice)
 *   node apply.mjs --dir ./my-shop --check    show what would change, change nothing
 *   node apply.mjs ... --json                 machine-readable result
 *   node apply.mjs ... --no-git --no-generate skip the commit / the migration step
 *
 * Adds the files_uploads table, src/lib/storage.ts, /api/files/upload and the /files page,
 * the @vercel/blob dependency, documents BLOB_READ_WRITE_TOKEN in .env.example, records the
 * install and commits. Then generates the database migration if dependencies are installed.
 * Also warns about existing code that saves uploads into the website's own folder,
 * which works on your computer and breaks once deployed.
 * It never touches secrets: connecting a Blob store in Vercel adds the token by itself.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.1";
const VERCEL_BLOB = "^2.8.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(here, "..", "files");
const NEW_FILES = [
  "src/db/schema/files.ts",
  "src/lib/storage.ts",
  "src/app/api/files/upload/route.ts",
  "src/app/files/page.tsx",
  "src/app/files/uploader.tsx",
  "src/app/files/actions.ts",
];
// Earlier versions of our own files: replaced on upgrade only if the owner never edited them.
const PREVIOUS = {
  "src/lib/storage.ts": ["96f7d9675fd35cbeb70356d5f2b64581485016ae044c26fca58f294e0d862b63"], // 1.0.0
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
const result = { ok: false, skill: "file-upload", version: VERSION, changed: [], skipped: [], warnings: [], manual: [] };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function write(dir, rel, content) {
  if (!opts.check) {
    const to = path.join(dir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  result.changed.push(rel);
}

/** Find code that writes uploaded files to disk (public/, uploads/): fine locally, broken on Vercel/Cloudflare. */
function findLocalDiskUploads(dir) {
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?[jt]sx?)$/.test(e.name)) {
        const s = fs.readFileSync(p, "utf8");
        if (/\b(writeFile|writeFileSync|createWriteStream)\b/.test(s) && /["'`/](public|uploads?)\b/.test(s)) hits.push(path.relative(dir, p));
      }
    }
  };
  const src = path.join(dir, "src");
  if (fs.existsSync(src)) walk(src);
  return hits;
}

try {
  if (!opts.dir) throw Object.assign(new Error("--dir is required"), { code: 64 });
  const dir = path.resolve(opts.dir);
  const stackPath = path.join(dir, "stack.json");
  if (!fs.existsSync(stackPath)) throw Object.assign(new Error("No stack.json here — this is not an app-foundation project"), { code: 3, hint: "Install app-foundation first (episode 002)." });
  const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
  const installed = stack.installed || {};
  if (!installed["app-foundation"]) throw Object.assign(new Error("stack.json does not list app-foundation"), { code: 3 });
  if (!installed["db-connect"]) throw Object.assign(new Error("db-connect is not installed — the file list is kept in the database"), { code: 3, hint: "Install db-connect first (episode 003)." });
  if (!installed["auth-login"]) throw Object.assign(new Error("auth-login is not installed — only signed-in users may upload, or strangers could fill your storage"), { code: 3, hint: "Install auth-login first (episode 006)." });

  for (const f of findLocalDiskUploads(dir)) {
    result.warnings.push(`${f} saves uploads into the website's own folder. That works on your computer but fails on Vercel/Cloudflare (read-only, wiped on every deploy). Switch it to src/lib/storage.ts, which keeps files in object storage.`);
  }

  // 1. Our files (never overwrite something the owner changed)
  for (const rel of NEW_FILES) {
    const src = fs.readFileSync(path.join(FILES, rel), "utf8");
    const to = path.join(dir, rel);
    if (!fs.existsSync(to)) write(dir, rel, src);
    else if (fs.readFileSync(to, "utf8") === src) continue;
    else if ((PREVIOUS[rel] || []).includes(sha(to))) write(dir, rel, src);
    else result.skipped.push(`${rel} (exists, kept yours)`);
  }

  // 2. Schema index
  const idxPath = path.join(dir, "src/db/schema/index.ts");
  const idx = fs.readFileSync(idxPath, "utf8");
  if (!/from\s+["']\.\/files["']/.test(idx)) write(dir, "src/db/schema/index.ts", idx.trimEnd() + '\nexport * from "./files";\n');

  // 3. Dependency
  const pkgPath = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (!pkg.dependencies?.["@vercel/blob"]) {
    pkg.dependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, "@vercel/blob": VERCEL_BLOB }).sort(([a], [b]) => a.localeCompare(b)));
    write(dir, "package.json", JSON.stringify(pkg, null, 2) + "\n");
  }

  // 4. .env.example
  const envEx = path.join(dir, ".env.example");
  const env = fs.existsSync(envEx) ? fs.readFileSync(envEx, "utf8") : "";
  if (!/BLOB_READ_WRITE_TOKEN/.test(env)) {
    write(dir, ".env.example", env.trimEnd() +
      "\n\n# file-upload (episode 008) — added automatically when you connect a Blob store\n" +
      "# in Vercel → Storage → Create → Blob (Public, tick \"Add a read-write token env var\").\n" +
      "# BLOB_READ_WRITE_TOKEN=...\n");
  }

  // 5. Record the install
  if (installed["file-upload"] !== VERSION) {
    write(dir, "stack.json", JSON.stringify({ ...stack, installed: { ...installed, "file-upload": VERSION } }, null, 2) + "\n");
  }

  // 6. Migration for files_uploads
  const journal = path.join(dir, "drizzle/meta/_journal.json");
  const drizzleDir = path.join(dir, "drizzle");
  const hasMigration = fs.existsSync(drizzleDir) &&
    fs.readdirSync(drizzleDir).some((f) => f.endsWith(".sql") && fs.readFileSync(path.join(drizzleDir, f), "utf8").includes('"files_uploads"'));
  if (!hasMigration) {
    const kit = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
    if (!opts.check && opts.generate && fs.existsSync(kit) && fs.existsSync(journal)) {
      const g = spawnSync(kit, ["generate", "--name", "file_upload"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
      if (g.status === 0) result.changed.push("drizzle/ (file_upload migration)");
      else result.manual.push(`Generate the migration: npm install && npm run db:generate -- --name file_upload\n${g.stderr || g.stdout}`);
    } else {
      result.manual.push("Generate the migration: npm install, then npm run db:generate -- --name file_upload, and commit the drizzle/ folder");
    }
  }

  // 7. Save point
  if (!opts.check && opts.git && result.changed.length && fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const c = spawnSync("git", ["commit", "-q", "-m", "Add file-upload: uploads to Vercel Blob, /files page"], { cwd: dir, encoding: "utf8" });
    result.committed = c.status === 0;
  }

  result.ok = true;
  result.next = [
    "Owner: Vercel → project → Storage → Create → Blob → Public + tick \"Add a read-write token env var\" → Create (adds BLOB_READ_WRITE_TOKEN)",
    "Push (or redeploy), sign in, open /files, upload an image, redeploy again and check it's still there",
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
