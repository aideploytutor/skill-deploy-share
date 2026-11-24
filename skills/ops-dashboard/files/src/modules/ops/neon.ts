/**
 * ops-dashboard: how much of Neon's monthly compute quota this project has used.
 * Free plan: 100 CU-hours per project per month; past that the database is suspended
 * until next month. Reading this does not wake the database (it asks Neon's API, not Postgres).
 *
 * Needs NEON_API_KEY (secret) and NEON_PROJECT_ID (Neon → project → Settings; not a secret).
 * NEON_CU_HOURS_LIMIT overrides the 100 (e.g. on a paid plan).
 */

export type NeonUsage = { usedCuHours: number; limit: number; pct: number; periodStart: Date | null; lastActive: Date | null };

export function isNeonConfigured(): boolean {
  return Boolean(process.env.NEON_API_KEY && process.env.NEON_PROJECT_ID);
}

let memo: { at: number; value: NeonUsage } | null = null;

export async function getNeonUsage(): Promise<NeonUsage | null> {
  if (!isNeonConfigured()) return null;
  if (memo && Date.now() - memo.at < 10 * 60_000) return memo.value; // Neon updates usage about every 15 minutes
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(process.env.NEON_PROJECT_ID!)}`, {
    headers: { authorization: `Bearer ${process.env.NEON_API_KEY}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Neon API answered ${res.status}`);
  const { project: p } = (await res.json()) as {
    project?: { compute_time_seconds?: number; consumption_period_start?: string; compute_last_active_at?: string };
  };
  if (!p || typeof p.compute_time_seconds !== "number") throw new Error("Neon API: no compute_time_seconds");
  const limit = Number(process.env.NEON_CU_HOURS_LIMIT) || 100;
  const used = p.compute_time_seconds / 3600; // CU-seconds → CU-hours
  const value: NeonUsage = {
    usedCuHours: Math.round(used * 10) / 10,
    limit,
    pct: Math.round((used / limit) * 100),
    periodStart: p.consumption_period_start ? new Date(p.consumption_period_start) : null,
    lastActive: p.compute_last_active_at ? new Date(p.compute_last_active_at) : null,
  };
  memo = { at: Date.now(), value };
  return value;
}
