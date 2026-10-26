import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSetupMissing, getCurrentUser, isGoogleConfigured } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import LoginForm from "./login-form";
import SecretMaker from "./secret-maker";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const missing = authSetupMissing();

  if (missing.length) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-16">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">auth-login</span>
        <h1 className="text-3xl font-black">Sign-in isn't set up yet</h1>
        <p className="text-muted">The site owner needs to add these in the host's settings (Cloudflare → Worker → Settings → Variables and Secrets):</p>
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
        <h1 className="text-3xl font-black">Sign in</h1>
        <p className="text-muted">Your first sign-in creates your account. No password needed.</p>
      </header>
      {error && (
        <p className="rounded-2xl border border-line p-4 text-sm">Sign-in didn't work ({error}). Please try again.</p>
      )}
      <LoginForm next={safeNext} google={isGoogleConfigured()} email={isEmailConfigured()} />
    </main>
  );
}
