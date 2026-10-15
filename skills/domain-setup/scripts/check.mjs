#!/usr/bin/env node
/**
 * domain-setup — check that a custom domain reaches your Vercel site over HTTPS.
 *
 *   node check.mjs --domain shop.example.com
 *   node check.mjs --domain example.com --www          also check www.example.com
 *   node check.mjs --domain example.com --json         machine-readable
 *   node check.mjs --domain example.com --wait 600     keep checking up to 10 min (DNS can be slow)
 *
 * Read-only: looks up public DNS (DNS-over-HTTPS) and opens the site. Changes nothing.
 * Needs Node.js 18+.
 */

const opts = { www: false, json: false, wait: 0 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--domain") opts.domain = (argv[++i] || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  else if (a === "--www") opts.www = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--wait") opts.wait = Number(argv[++i] || 0);
  else if (a === "--help" || a === "-h") { console.log(HELP()); process.exit(0); }
  else { console.error(`✖ unknown option ${a}`); process.exit(64); }
}
function HELP() { return "node check.mjs --domain <domain> [--www] [--wait <seconds>] [--json]"; }
if (!opts.domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(opts.domain)) { console.error("✖ --domain is required, e.g. --domain shop.example.com"); process.exit(64); }

const DOH = process.env.DOMAIN_SETUP_DOH || "https://cloudflare-dns.com/dns-query";
const log = (...m) => (opts.json ? console.error(...m) : console.log(...m));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dns(name, type) {
  const r = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
  if (!r.ok) throw new Error(`DNS lookup failed (${r.status})`);
  const j = await r.json();
  return (j.Answer || []).filter((a) => a.type === { A: 1, CNAME: 5, CAA: 257, NS: 2, AAAA: 28 }[type]).map((a) => a.data.replace(/\.$/, ""));
}

const CF_RANGES = ["104.16.", "104.17.", "104.18.", "104.19.", "104.20.", "104.21.", "172.64.", "172.65.", "172.66.", "172.67.", "188.114."];

async function checkHost(host) {
  const out = { host, dns: {}, https: {}, problems: [], notes: [], ok: false };
  const [a, cname, aaaa] = await Promise.all([dns(host, "A"), dns(host, "CNAME"), dns(host, "AAAA")]);
  out.dns = { A: a, CNAME: cname, AAAA: aaaa };
  if (!a.length && !cname.length) {
    out.problems.push({ code: "no-dns", msg: `${host} has no A or CNAME record yet`, fix: "Add the record shown in Vercel → Settings → Domains at your DNS provider. New records can take a few minutes (rarely up to 48 h) to appear." });
    return out;
  }
  if (cname.some((c) => c === "cname.vercel-dns.com") || (!cname.length && a.includes("76.76.21.21"))) {
    out.notes.push({ code: "legacy-record", msg: `${host} uses Vercel's legacy value (${cname[0] || "76.76.21.21"}) — it still works`, fix: "Vercel → Settings → Domains may say \"DNS Change Recommended\": switch to the project-specific value it shows (e.g. xxxx.vercel-dns-017.com)." });
  }
  if (a.some((ip) => CF_RANGES.some((p) => ip.startsWith(p)))) {
    out.problems.push({ code: "cloudflare-proxy", msg: `${host} resolves to Cloudflare proxy IPs (orange cloud)`, fix: "In Cloudflare DNS, click the orange cloud next to this record so it turns grey (DNS only). Vercel does not recommend a proxy in front of it." });
  }
  if (aaaa.length) {
    out.problems.push({ code: "aaaa", msg: `${host} also has AAAA (IPv6) records: ${aaaa.join(", ")}`, fix: "Delete AAAA records for this name unless Vercel's domain card lists them; they can send visitors somewhere else." });
  }

  // HTTPS
  const started = Date.now();
  try {
    const res = await fetch(`https://${host}/`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    out.https = {
      status: res.status,
      ms: Date.now() - started,
      server: res.headers.get("server") || "",
      redirect: res.headers.get("location") || null,
      vercel: Boolean(res.headers.get("x-vercel-id")) || /vercel/i.test(res.headers.get("server") || ""),
    };
    if (!out.https.vercel) {
      out.problems.push({ code: "not-vercel", msg: `${host} answers, but not from Vercel (server: ${out.https.server || "unknown"})`, fix: "The record still points to an old host, or a proxy is in front. Compare it with the value on Vercel's domain card." });
    }
    if (res.status === 404 && out.https.vercel) {
      out.problems.push({ code: "vercel-404", msg: `Vercel answers for ${host} but returns 404`, fix: "Add this exact domain in Vercel → project → Settings → Domains." });
    }
  } catch (e) {
    const code = e?.cause?.code || e?.name || "";
    const cert = /CERT|SSL|TLS|ERR_TLS/i.test(code + " " + (e?.cause?.message || ""));
    out.https = { error: code || e.message };
    out.problems.push(cert
      ? { code: "cert-pending", msg: `HTTPS certificate for ${host} is not ready yet`, fix: "Vercel issues it automatically a few minutes after DNS is correct. Wait and re-run with --wait 600. If you have CAA records, they must allow letsencrypt.org." }
      : { code: "https-failed", msg: `Could not open https://${host} (${code || e.message})`, fix: "Usually DNS hasn't spread yet. Re-run with --wait 600." });
  }
  out.ok = out.problems.length === 0;
  return out;
}

async function checkCaa(domain) {
  // CAA lives on the registrable domain or a parent; check the name and its parent.
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const name = parts.slice(i).join(".");
    const caa = await dns(name, "CAA");
    if (caa.length) {
      const allows = caa.some((r) => /issue(wild)?\s+"?letsencrypt\.org/i.test(r));
      return { name, records: caa, allowsLetsEncrypt: allows };
    }
  }
  return { name: domain, records: [], allowsLetsEncrypt: true };
}

async function once() {
  const hosts = [opts.domain];
  if (opts.www && !opts.domain.startsWith("www.")) hosts.push(`www.${opts.domain}`);
  const results = await Promise.all(hosts.map(checkHost));
  const caa = await checkCaa(opts.domain);
  if (!caa.allowsLetsEncrypt) {
    results[0].problems.push({ code: "caa", msg: `CAA records on ${caa.name} do not allow Let's Encrypt`, fix: `Add a CAA record: 0 issue "letsencrypt.org"` });
    results[0].ok = false;
  }
  return { ok: results.every((r) => r.ok), domain: opts.domain, results, caa };
}

let report;
const deadline = Date.now() + opts.wait * 1000;
for (;;) {
  try { report = await once(); }
  catch (e) { report = { ok: false, domain: opts.domain, error: e.message }; }
  if (report.ok || Date.now() >= deadline) break;
  log(`… not ready yet (${(report.results || []).flatMap((r) => r.problems.map((p) => p.code)).join(", ") || report.error}), checking again in 30 s`);
  await sleep(30000);
}

if (opts.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else if (report.error) {
  console.log(`✖ ${report.error}`);
} else {
  for (const r of report.results) {
    const rec = r.dns.CNAME?.length ? `CNAME → ${r.dns.CNAME.join(", ")}` : `A → ${(r.dns.A || []).join(", ") || "—"}`;
    console.log(`\n${r.ok ? "✔" : "✖"} ${r.host}   (${rec})`);
    if (r.https.status) console.log(`  https: ${r.https.status}${r.https.redirect ? ` → ${r.https.redirect}` : ""} · ${r.https.ms} ms · ${r.https.vercel ? "served by Vercel" : r.https.server}`);
    for (const p of r.problems) console.log(`  ⚠ ${p.msg}\n    → ${p.fix}`);
    for (const n of r.notes || []) console.log(`  ℹ ${n.msg}\n    → ${n.fix}`);
  }
  console.log(report.ok ? `\nAll good: https://${opts.domain} is live on Vercel with HTTPS.` : "\nNot ready yet — fix the items above, or re-run with --wait 600.");
}
process.exitCode = report.ok ? 0 : 2;
