import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignOut from "./sign-out";

export const metadata: Metadata = { title: "我的账号" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/account");

  const rows: [string, string][] = [
    ["名字", user.name || "（未设置）"],
    ["邮箱", user.email],
    ["邮箱已验证", user.emailVerified ? "是" : "否"],
    ["注册时间", new Date(user.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })],
  ];
  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-5 py-16">
      <header className="flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" width={56} height={56} className="size-14 rounded-full border border-line" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-accent text-xl font-black text-white">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-muted">auth-login · 已登录</span>
          <h1 className="truncate text-2xl font-black">{user.name || user.email}</h1>
        </div>
      </header>
      <dl className="divide-y divide-line rounded-2xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-4 p-4">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <SignOut />
    </main>
  );
}
