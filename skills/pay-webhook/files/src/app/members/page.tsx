import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDbConfigured } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { ensureGrants, listGrants } from "@/lib/pay-webhook";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

/**
 * pay-webhook (episode 012): what buyers unlock. Paying opens it, a full refund or a
 * chargeback closes it again, all by itself. Replace the "Your paid content" block with yours.
 * To lock any other page: `if (!(await hasAccess(user.id, productId))) redirect("/pricing")`.
 */
export default async function MembersPage() {
  if (!isDbConfigured()) redirect("/pricing");
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/members");

  await ensureGrants(user.id); // in case the webhook hasn't arrived yet
  const grants = await listGrants(user.id);
  const active = grants.filter((g) => !g.revokedAt);
  const revoked = grants.filter((g) => g.revokedAt);
  const unlocked = active.length > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">pay-webhook</span>
        <h1 className="text-3xl font-black">Members</h1>
      </header>

      {unlocked ? (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-accent p-6">
          <span className="text-5xl" aria-hidden>🔓</span>
          <h2 className="text-2xl font-black">Unlocked</h2>
          <p className="text-muted">Thanks for your purchase. Everything below is yours.</p>
          <div className="rounded-xl bg-accent/10 p-4 text-sm">
            <b>Your paid content goes here.</b> Downloads, lessons, a license key, the premium feature: put it in{" "}
            <code>src/app/members/page.tsx</code>.
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-line p-6">
          <span className="text-5xl" aria-hidden>🔒</span>
          <h2 className="text-2xl font-black">Locked</h2>
          <p className="text-muted">
            {revoked.length ? "Access was removed after a refund." : "Buy once and this page unlocks right away."}
          </p>
          <Link href="/pricing" className="w-fit rounded-full bg-accent px-6 py-3 font-bold text-white">
            See pricing
          </Link>
        </section>
      )}

      {grants.length > 0 && (
        <section className="rounded-2xl border border-line p-5">
          <h2 className="mb-3 font-bold">Access history</h2>
          <ol className="flex flex-col divide-y divide-line text-sm">
            {grants.map((g) => (
              <li key={g.id} className="flex items-baseline justify-between gap-4 py-2">
                <span>{g.revokedAt ? `❌ Removed · ${g.revokeReason}` : "✅ Active"}</span>
                <time className="tabular-nums text-muted">
                  {(g.revokedAt ?? g.grantedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
