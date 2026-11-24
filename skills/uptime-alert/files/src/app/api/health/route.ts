import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import stack from "../../../../stack.json";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  if (!isDbConfigured()) return { status: "not configured" as const };
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return { status: "connected" as const, latencyMs: Date.now() - started };
  } catch (err) {
    // Logged for the owner (Vercel/Cloudflare logs); connection details are masked.
    const e = err as Error & { cause?: { message?: string; code?: string } };
    const why = [e?.cause?.code, e?.cause?.message ?? e?.message ?? String(err)].filter(Boolean).join(" ");
    console.error("[health] database check failed:", why.replace(/\/\/[^@\s]*@/g, "//***@"));
    return { status: "error" as const };
  }
}

/**
 * Used by uptime monitors (uptime-alert, episode 016) and by skills to check the app is up.
 * Monitors look for the keyword "status":"up".
 *
 * The database is NOT touched by default: a monitor calling every 5 minutes would keep a
 * scale-to-zero database (Neon free: suspends after 5 idle minutes) awake 24/7 and burn its
 * monthly compute quota. Add ?db=1 for a deep check (the hourly payment catch-up and backups
 * already alert you by email when the database is down).
 * HEALTH_FORCE_DOWN=true answers "down" on purpose, to test the alert (remove it afterwards).
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("db") === "1";
  const database = deep ? await checkDatabase() : { status: "not checked (add ?db=1)" as const };
  const drill = process.env.HEALTH_FORCE_DOWN === "true";
  const up = database.status !== "error" && !drill;
  return NextResponse.json(
    {
      status: up ? "up" : "down",
      ok: up,
      ...(drill ? { reason: "HEALTH_FORCE_DOWN is on (alert test)" } : {}),
      app: stack.name,
      skills: Object.keys(stack.installed),
      database,
      time: new Date().toISOString(),
    },
    { status: up ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

/** Some monitors send HEAD: same answer, no body. */
export async function HEAD(req: Request) {
  const res = await GET(req);
  return new Response(null, { status: res.status, headers: res.headers });
}
