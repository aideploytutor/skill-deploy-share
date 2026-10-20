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

/** Used by uptime monitors and by skills to check the app is up. */
export async function GET() {
  const database = await checkDatabase();
  return NextResponse.json(
    {
      ok: database.status !== "error",
      app: stack.name,
      skills: Object.keys(stack.installed),
      database,
      time: new Date().toISOString(),
    },
    { status: database.status === "error" ? 503 : 200 },
  );
}
