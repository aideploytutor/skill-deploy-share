#!/usr/bin/env node
/**
 * Install skills from this repo into one or more AI coding agents.
 *
 *   node install.mjs                         # all skills → all agents (user level)
 *   node install.mjs --agent claude,cursor   # pick agents
 *   node install.mjs --project ./my-app      # install into a project instead of your home folder
 *   node install.mjs github-vercel-deploy    # pick skills
 *   node install.mjs --list                  # show skills and target paths
 *
 * Paths follow the Agent Skills convention (<dir>/<skill-name>/SKILL.md).
 * If your tool uses a different folder, edit AGENTS below or copy skills/<name> there by hand.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS = {
  claude:  { user: ".claude/skills",  project: ".claude/skills",  label: "Claude Code / Claude desktop" },
  cursor:  { user: ".cursor/skills",  project: ".cursor/skills",  label: "Cursor" },
  copilot: { user: ".copilot/skills", project: ".github/skills",  label: "VS Code + GitHub Copilot" },
  codex:   { user: ".agents/skills",  project: ".agents/skills",  label: "OpenAI Codex (and other .agents-aware tools)" },
  gemini:  { user: ".gemini/skills",  project: ".gemini/skills",  label: "Gemini CLI" },
};

const here = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.join(here, "skills");
const available = fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, "SKILL.md")));

const args = process.argv.slice(2);
let agents = Object.keys(AGENTS), project = null, list = false;
const picked = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--agent" || a === "--agents") agents = (args[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
  else if (a === "--project") project = path.resolve(args[++i] || ".");
  else if (a === "--list") list = true;
  else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }
  else if (a.startsWith("-")) { console.error(`Unknown option ${a}`); process.exit(64); }
  else picked.push(a);
}
if (agents.includes("all")) agents = Object.keys(AGENTS);
const bad = agents.filter((a) => !AGENTS[a]);
if (bad.length) { console.error(`Unknown agent(s): ${bad.join(", ")}. Choose from: ${Object.keys(AGENTS).join(", ")}, all`); process.exit(64); }
const skills = picked.length ? picked : available;
const missing = skills.filter((s) => !available.includes(s));
if (missing.length) { console.error(`Unknown skill(s): ${missing.join(", ")}. Available: ${available.join(", ")}`); process.exit(64); }

const base = project || os.homedir();
const target = (a) => path.join(base, project ? AGENTS[a].project : AGENTS[a].user);

if (list) {
  console.log("Skills:\n  " + available.join("\n  "));
  console.log(`\nTargets (${project ? "project " + project : "user " + base}):`);
  for (const a of Object.keys(AGENTS)) console.log(`  ${a.padEnd(8)} ${target(a)}   (${AGENTS[a].label})`);
  process.exit(0);
}

for (const a of agents) {
  for (const s of skills) {
    const dest = path.join(target(a), s);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(path.join(skillsDir, s), dest, { recursive: true });
    console.log(`✔ ${s} → ${dest}`);
  }
}
console.log("\nDone. Restart your agent / IDE (or open a new chat) so it picks up the skills.");
