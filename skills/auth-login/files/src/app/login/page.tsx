import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSetupMissing, getCurrentUser, isGoogleConfigured } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import LoginForm from "./login-form";
import SecretMaker from "./secret-maker";

export const metadata: Metadata = { title: "登录" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const missing = authSetupMissing();

  if (missing.length) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-16">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">auth-login</span>
        <h1 className="text-3xl font-black">登录还没配好</h1>
        <p className="text-muted">网站主人需要在 Vercel → Settings → Environment Variables 里补上：</p>
        <ul className="flex flex-col gap-2">
          {missing.map((m) => (
            <li key={m}><code className="rounded-md bg-line/60 px-2 py-0.5 text-sm">{m}</code></li>
          ))}
        </ul>
        {missing.includes("BETTER_AUTH_SECRET") && <SecretMaker />}
      </main>
    );
  }

  if (await getCurrentUser(await headers())) redirect(safeNext);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">auth-login</span>
        <h1 className="text-3xl font-black">登录</h1>
        <p className="text-muted">第一次登录会自动注册，不用设密码。</p>
      </header>
      {error && (
        <p className="rounded-2xl border border-line p-4 text-sm">登录没有成功（{error}），请再试一次。</p>
      )}
      <LoginForm next={safeNext} google={isGoogleConfigured()} email={isEmailConfigured()} />
    </main>
  );
}
