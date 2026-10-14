import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";
import { getStackStatus } from "@/lib/stack";

export const metadata: Metadata = { title: "底座状态" };
export const dynamic = "force-dynamic";

async function databaseLine(): Promise<string> {
  if (!isDbConfigured()) return "未连接（第 003 期 db-connect）";
  const started = Date.now();
  try {
    const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(coreEvents);
    return `已连接 · ${Date.now() - started} ms · 事件 ${row?.n ?? 0} 条`;
  } catch {
    return "连接失败（检查 DATABASE_URL）";
  }
}

export default async function StatusPage() {
  const s = getStackStatus();
  const rows: [string, string][] = [
    ["项目名称", s.name],
    ["创建时间", s.createdAt],
    ["已安装的 Skill", Object.entries(s.installed).map(([k, v]) => `${k}@${v}`).join("、")],
    ["数据库", await databaseLine()],
    ["运行环境", process.env.VERCEL ? "Vercel" : process.env.CF_PAGES || process.env.CLOUDFLARE ? "Cloudflare" : "本地或其他"],
  ];
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="mb-6 text-3xl font-black">底座状态</h1>
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
