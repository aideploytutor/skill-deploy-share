import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { getStackStatus } from "@/lib/stack";

export const metadata: Metadata = { title: "Foundation status" };
export const dynamic = "force-dynamic";

async function databaseLine(): Promise<string> {
  if (!isDbConfigured()) return "Not connected (episode 003, db-connect)";
  const started = Date.now();
  try {
    const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(coreEvents);
    return `Connected · ${Date.now() - started} ms · ${row?.n ?? 0} events`;
  } catch {
    return "Connection failed (check DATABASE_URL)";
  }
}

export default async function StatusPage() {
  const s = getStackStatus();
  const rows: [string, string][] = [
    ["Project name", s.name],
    ["Created", s.createdAt],
    ["Installed skills", Object.entries(s.installed).map(([k, v]) => `${k}@${v}`).join(", ")],
    ["Database", await databaseLine()],
    ["Runtime", process.env.VERCEL ? "Vercel" : process.env.CF_PAGES || process.env.CLOUDFLARE ? "Cloudflare" : "Local or other"],
  ];
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="mb-6 text-3xl font-black">Foundation status</h1>
      <dl className="divide-y divide-line rounded-2xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 p-4">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
