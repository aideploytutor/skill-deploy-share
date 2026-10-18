import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { emitEvent } from "@/lib/events";

export const metadata: Metadata = { title: "Database test" };
export const dynamic = "force-dynamic";

const KEEP = 20; // only the newest test rows are kept, so this page can't fill the database

async function saveTestRow() {
  "use server";
  if (!isDbConfigured()) return;
  await emitEvent({ type: "db.test", source: "db-connect", payload: { note: "test row" } });
  await getDb().execute(sql`
    delete from core_events
    where type = 'db.test'
      and id not in (select id from core_events where type = 'db.test' order by created_at desc limit ${KEEP})
  `);
  revalidatePath("/db-test");
}

export default async function DbTestPage() {
  if (!isDbConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="mb-4 text-3xl font-black">Database test</h1>
        <p className="text-muted">No database connected yet. Tell your AI: "Use db-connect to connect a free database to my project."</p>
      </main>
    );
  }

  const db = getDb();
  const rows = await db
    .select({ id: coreEvents.id, createdAt: coreEvents.createdAt })
    .from(coreEvents)
    .where(eq(coreEvents.type, "db.test"))
    .orderBy(desc(coreEvents.createdAt))
    .limit(5);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(coreEvents)
    .where(eq(coreEvents.type, "db.test"));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">db-connect</span>
        <h1 className="text-3xl font-black">Database test</h1>
        <p className="text-muted">Press the button to save a row, then reload the page. If the row is still there, your site really can save data.</p>
      </header>

      <form action={saveTestRow}>
        <button
          type="submit"
          className="rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95"
        >
          Save a test row
        </button>
      </form>

      <section className="rounded-2xl border border-line p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold">Saved</h2>
          <span className="text-sm tabular-nums text-muted">{n} rows (keeps the latest {KEEP})</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted">No rows yet. Try the button above.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between gap-4 py-2 text-sm">
                <code className="truncate text-muted">{r.id.slice(0, 8)}</code>
                <time className="tabular-nums">
                  {r.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
