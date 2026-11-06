/**
 * uptime-alert (episode 016): read the site's monitor from UptimeRobot so /ops can show it.
 * Needs UPTIMEROBOT_API_KEY = a READ-ONLY key (UptimeRobot → Integrations & API → Read-Only API Key).
 * Read-only on purpose: even if it leaked, nobody could change or delete your monitors with it.
 * The alerts themselves (email, phone push) are sent by UptimeRobot, not by this code.
 */

export type Uptime = {
  name: string;
  url: string;
  status: "up" | "down" | "paused" | "pending";
  ratio: { d1: number | null; d7: number | null; d30: number | null }; // percent
  lastDown: { at: Date; minutes: number } | null;
  downs30d: number;
};

type RawLog = { type: number; datetime: number; duration: number };
type RawMonitor = { friendly_name: string; url: string; status: number; custom_uptime_ratio?: string; logs?: RawLog[] };

export function isUptimeConfigured(): boolean {
  return Boolean(process.env.UPTIMEROBOT_API_KEY);
}

/** Which monitor to show: the one whose URL contains UPTIME_MONITOR_MATCH, else the site's domain, else the first. */
function pick(monitors: RawMonitor[]): RawMonitor | undefined {
  const hint = process.env.UPTIME_MONITOR_MATCH || process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return (hint && monitors.find((m) => m.url.includes(hint))) || monitors[0];
}

// The free plan allows 10 API calls a minute, so one answer is reused for a minute.
let memo: { at: number; value: Uptime | null } | null = null;

export async function getUptime(): Promise<Uptime | null> {
  const key = process.env.UPTIMEROBOT_API_KEY;
  if (!key) return null;
  if (memo && Date.now() - memo.at < 60_000) return memo.value;

  const body = new URLSearchParams({ api_key: key, format: "json", logs: "1", logs_limit: "50", custom_uptime_ratios: "1-7-30" });
  const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
    body,
  });
  if (!res.ok) throw new Error(`UptimeRobot answered ${res.status}`);
  const data = (await res.json()) as { stat: string; error?: { message?: string }; monitors?: RawMonitor[] };
  if (data.stat !== "ok") throw new Error(`UptimeRobot: ${data.error?.message ?? "error"}`);

  const m = pick(data.monitors ?? []);
  let value: Uptime | null = null;
  if (m) {
    const [d1, d7, d30] = (m.custom_uptime_ratio ?? "").split("-").map((x) => (x ? Number(x) : null));
    const since = Date.now() / 1000 - 30 * 86400;
    const downs = (m.logs ?? []).filter((l) => l.type === 1); // 1 = down, 2 = up, 98 = started, 99 = paused
    const last = downs[0];
    value = {
      name: m.friendly_name,
      url: m.url,
      status: m.status === 2 ? "up" : m.status === 8 || m.status === 9 ? "down" : m.status === 0 ? "paused" : "pending",
      ratio: { d1: d1 ?? null, d7: d7 ?? null, d30: d30 ?? null },
      lastDown: last ? { at: new Date(last.datetime * 1000), minutes: Math.max(1, Math.round(last.duration / 60)) } : null,
      downs30d: downs.filter((l) => l.datetime >= since).length,
    };
  }
  memo = { at: Date.now(), value };
  return value;
}
