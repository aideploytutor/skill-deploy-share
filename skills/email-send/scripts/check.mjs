#!/usr/bin/env node
/**
 * email-send — check the DNS records that let Resend send from your domain.
 *
 *   node check.mjs --domain mail.example.com             the domain you added in Resend
 *   node check.mjs --domain mail.example.com --wait 900  keep checking up to 15 min
 *   node check.mjs --domain mail.example.com --json
 *
 * Read-only: looks up public DNS (DNS-over-HTTPS). Changes nothing, needs no key.
 * Checks: DKIM (resend._domainkey), SPF + MX on the return-path (send.), DMARC,
 * and the classic mistake of a DNS panel adding your domain twice to the Host.
 */
const opts = { json: false, wait: 0, returnPath: "send" };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--domain") opts.domain = (argv[++i] || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  else if (a === "--return-path") opts.returnPath = argv[++i];
  else if (a === "--json") opts.json = true;
  else if (a === "--wait") opts.wait = Number(argv[++i] || 0);
  else if (a === "--help" || a === "-h") { console.log("node check.mjs --domain <sending domain> [--return-path send] [--wait <s>] [--json]"); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}
if (!opts.domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(opts.domain)) { console.error("✖ --domain is required, e.g. --domain mail.example.com"); process.exit(64); }

const DOH = process.env.DOMAIN_SETUP_DOH || "https://cloudflare-dns.com/dns-query";
const TYPES = { TXT: 16, MX: 15, CNAME: 5 };
const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dns(name, type) {
  const r = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
  if (!r.ok) throw new Error(`DNS lookup failed (${r.status})`);
  const j = await r.json();
  return (j.Answer || []).filter((a) => a.type === TYPES[type]).map((a) =>
    type === "TXT" ? a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "") : a.data.replace(/\.$/, ""));
}

// "mail.example.com" → "example.com" (good enough for the doubled-host check)
const parts = opts.domain.split(".");
const apex = parts.slice(-2).join(".");

async function once() {
  const d = opts.domain;
  const rp = `${opts.returnPath}.${d}`;
  const items = [];
  const add = (code, ok, label, found, fix) => items.push({ code, ok, label, found, fix });

  // DKIM — required
  const dkimName = `resend._domainkey.${d}`;
  const dkim = (await dns(dkimName, "TXT")).filter((t) => /p=/.test(t));
  add("dkim", dkim.length > 0, `DKIM  TXT  ${dkimName}`, dkim.map((t) => t.slice(0, 40) + "…"),
    "Add the DKIM TXT record from Resend → Domains → your domain. Copy the whole value.");

  // SPF — required (Resend sends through Amazon SES)
  const spf = (await dns(rp, "TXT")).filter((t) => /^v=spf1/i.test(t));
  add("spf", spf.some((t) => /amazonses\.com/i.test(t)), `SPF   TXT  ${rp}`, spf,
    spf.length > 1 ? "Only ONE v=spf1 record is allowed per name: merge them." : "Add the SPF TXT record from Resend (v=spf1 include:amazonses.com ~all).");
  if (spf.length > 1) items[items.length - 1].ok = false;

  // MX on the return path — required for bounces
  const mx = await dns(rp, "MX");
  add("mx", mx.some((m) => /amazonses\.com/i.test(m)), `MX    ${rp}`, mx,
    "Add the MX record from Resend (feedback-smtp.<region>.amazonses.com, priority 10).");

  // DMARC — recommended (not required by Resend)
  let dmarc = await dns(`_dmarc.${d}`, "TXT");
  let dmarcAt = `_dmarc.${d}`;
  if (!dmarc.some((t) => /^v=DMARC1/i.test(t)) && d !== apex) { dmarc = await dns(`_dmarc.${apex}`, "TXT"); dmarcAt = `_dmarc.${apex}`; }
  dmarc = dmarc.filter((t) => /^v=DMARC1/i.test(t));
  items.push({ code: "dmarc", ok: dmarc.length > 0, optional: true, label: `DMARC TXT  ${dmarcAt}`, found: dmarc,
    fix: `Recommended: TXT on _dmarc.${d} with v=DMARC1; p=none; — helps Gmail/Outlook trust you. Start with p=none.` });

  // Doubled host: Namecheap/GoDaddy append the domain themselves, so "resend._domainkey.mail.example.com" typed as Host
  // becomes resend._domainkey.mail.example.com.example.com
  const doubled = [];
  for (const name of [`resend._domainkey.${d}.${apex}`, `${rp}.${apex}`]) {
    if ((await dns(name, "TXT")).length || (await dns(name, "MX")).length) doubled.push(name);
  }
  if (doubled.length) {
    items.push({ code: "doubled-host", ok: false, label: "Host typed with the full domain", found: doubled,
      fix: `Your DNS panel adds ".${apex}" by itself. In the Host field type only the part before it, e.g. "resend._domainkey.${d.replace(`.${apex}`, "")}" — not the full name.` });
  }

  const required = items.filter((i) => !i.optional);
  return { ok: required.every((i) => i.ok), domain: d, items };
}

let report;
const deadline = Date.now() + opts.wait * 1000;
for (;;) {
  try { report = await once(); } catch (e) { report = { ok: false, domain: opts.domain, error: e.message }; }
  if (report.ok || Date.now() >= deadline) break;
  log(`… not ready yet (${(report.items || []).filter((i) => !i.ok && !i.optional).map((i) => i.code).join(", ") || report.error}), checking again in 30 s`);
  await sleep(30000);
}

if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
else if (report.error) console.log(`✖ ${report.error}`);
else {
  console.log(`\nSending domain: ${report.domain}\n`);
  for (const i of report.items) {
    console.log(`${i.ok ? "✔" : i.optional ? "○" : "✖"} ${i.label}${i.optional ? "  (recommended)" : ""}`);
    if (i.found?.length) console.log(`    found: ${i.found.join(" | ")}`);
    if (!i.ok) console.log(`    → ${i.fix}`);
  }
  console.log(report.ok
    ? "\nDNS looks right. In Resend → Domains, the domain should turn Verified (often within 15 min)."
    : "\nNot ready yet — fix the ✖ items, or re-run with --wait 900. New records can take a while to appear.");
}
process.exitCode = report.ok ? 0 : 2;
