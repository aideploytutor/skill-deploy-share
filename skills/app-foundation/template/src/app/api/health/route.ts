import { NextResponse } from "next/server";
import { isDbConfigured } from "@/db";
import stack from "../../../../stack.json";

export const dynamic = "force-dynamic";

/** Used by uptime monitors and by skills to check the app is up. */
export function GET() {
  return NextResponse.json({
    ok: true,
    app: stack.name,
    skills: Object.keys(stack.installed),
    database: isDbConfigured() ? "configured" : "not configured",
    time: new Date().toISOString(),
  });
}
