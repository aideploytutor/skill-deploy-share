import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { emitEvent } from "@/lib/events";

export const metadata: Metadata = { title: "数据库测试" };
export const dynamic = "force-dynamic";

const KEEP = 20; // only the newest test rows are kept, so this page can't fill the database

async function saveTestRow() {
  "use server";
  if (!isDbConfigured()) return;
  await emitEvent({ type: "db.test", source: "db-connect", payload: { note: "测试数据" } });
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
        <h1 className="mb-4 text-3xl font-black">数据库测试</h1>
        <p className="text-muted">还没有连接数据库。对 AI 说：「用 db-connect 给我的项目连上一个免费数据库」。</p>
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
        <h1 className="text-3xl font-black">数据库测试</h1>
        <p className="text-muted">点一下按钮存一条数据，刷新页面，数据还在，说明网站真的能存东西了。</p>
      </header>

      <form action={saveTestRow}>
        <button
          type="submit"
          className="rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95"
        >
          存一条测试数据
        </button>
      </form>

      <section className="rounded-2xl border border-line p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold">已保存</h2>
          <span className="text-sm tabular-nums text-muted">共 {n} 条（最多保留 {KEEP} 条）</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted">还没有数据，点上面的按钮试试。</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between gap-4 py-2 text-sm">
                <code className="truncate text-muted">{r.id.slice(0, 8)}</code>
                <time className="tabular-nums">
                  {r.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
