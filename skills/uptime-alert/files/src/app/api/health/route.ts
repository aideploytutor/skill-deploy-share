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
 * Monitors look for the keyword "status":"up". HEALTH_FORCE_DOWN=true answers "down" on purpose,
 * so the owner can test that the alert really reaches their phone (remove it afterwards).
 */
export async function GET() {
  const database = await checkDatabase();
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
export async function HEAD() {
  const res = await GET();
  return new Response(null, { status: res.status, headers: res.headers });
}
