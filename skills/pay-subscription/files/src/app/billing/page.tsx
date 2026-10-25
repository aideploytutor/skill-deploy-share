import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDbConfigured } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, getProduct, isPayConfigured, payMode, startCheckout } from "@/lib/pay";
import { accessUntil, hasAccessNow, listSubscriptions, portalLink, syncSubscription } from "@/lib/pay-subscription";

export const metadata: Metadata = { title: "Membership" };
export const dynamic = "force-dynamic";

const PLAN = process.env.CREEM_SUBSCRIPTION_PRODUCT_ID ?? "";

async function subscribe() {
  "use server";
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/billing");
  redirect(await startCheckout({ id: user.id, email: user.email }, PLAN));
}

async function manage() {
  "use server";
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/billing");
  const sub = (await listSubscriptions(user.id)).find((s) => s.customerId);
  if (!sub?.customerId) redirect("/billing");
  redirect(await portalLink(sub.customerId));
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
const per = (p?: string) => (p === "every-year" ? "year" : p === "every-three-months" ? "3 months" : p === "every-six-months" ? "6 months" : "month");

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">pay-subscription</span>
          {isPayConfigured() && payMode() === "test" && (
            <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">TEST MODE · no real money</span>
          )}
        </div>
        <h1 className="text-3xl font-black">Membership</h1>
      </header>
      {children}
    </main>
  );
}

/**
 * pay-subscription (episode 013): subscribe once, pay every month automatically.
 * Shows the plan, the subscriber's status and next renewal, and a link to Creem's portal to cancel.
 */
export default async function BillingPage() {
  if (!isDbConfigured() || !isPayConfigured() || !PLAN) {
    return (
      <Shell>
        <p className="text-muted">
          The site owner needs to create a monthly product in Creem and set <code>CREEM_SUBSCRIPTION_PRODUCT_ID</code> in the
          host&apos;s settings (it starts with prod_).
        </p>
      </Shell>
    );
  }
  const user = await getCurrentUser(await headers());
  const product = await getProduct(PLAN);
  const period = per((product as { billing_period?: string }).billing_period);

  let sub = user ? (await listSubscriptions(user.id)).find((s) => s.productId === PLAN) : undefined;
  // A renewal that looks overdue: ask Creem (in case its webhook never arrived).
  if (sub && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now() && ["active", "past_due", "trialing"].includes(sub.status)) {
    sub = (await syncSubscription(sub.id).catch(() => undefined)) ?? sub;
  }
  const active = sub ? hasAccessNow(sub) : false;
  const until = sub ? accessUntil(sub) : null;
  const ending = sub && ["scheduled_cancel", "canceled"].includes(sub.status);

  return (
    <Shell>
      <section className="flex flex-col gap-4 rounded-2xl border border-line p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">{product.name}</h2>
          <span className="text-3xl font-black tabular-nums">
            {formatMoney(product.price, product.currency)}
            <span className="text-base font-bold text-muted"> / {period}</span>
          </span>
        </div>
        {product.description && <p className="text-muted">{product.description}</p>}

        {active && sub ? (
          <div className="flex flex-col gap-3 rounded-xl bg-accent/10 p-4">
            {ending ? (
              <p className="font-bold">Canceled · you keep access until {sub.currentPeriodEnd ? fmt(sub.currentPeriodEnd) : "the end of this period"}</p>
            ) : (
              <p className="font-bold">
                ✅ Active{sub.currentPeriodEnd ? ` · renews automatically on ${fmt(sub.currentPeriodEnd)}` : ""}
                {sub.status === "past_due" ? " · we couldn't charge your card, please update it" : ""}
              </p>
            )}
            <p className="text-sm text-muted">
              Paid {sub.renewals + 1} {sub.renewals ? "times" : "time"} so far.{" "}
              <Link href="/members" className="underline">Open members area</Link>
            </p>
            {sub.customerId && (
              <form action={manage}>
                <button type="submit" className="rounded-full border border-line px-5 py-2 text-sm font-bold">
                  Manage or cancel
                </button>
              </form>
            )}
          </div>
        ) : user ? (
          <form action={subscribe}>
            <button type="submit" className="w-full rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95">
              Subscribe · {formatMoney(product.price, product.currency)} / {period}
            </button>
          </form>
        ) : (
          <Link href="/login?next=/billing" className="w-full rounded-full bg-accent px-6 py-3 text-center font-bold text-white">
            Sign in to subscribe
          </Link>
        )}
        {sub && !active && until === null && <p className="text-sm text-muted">Your previous subscription has ended ({sub.status}).</p>}
        <p className="text-xs text-muted">
          Billed every {period} by Creem until you cancel. Cancel anytime; you keep access to the end of what you paid for.
          {payMode() === "test" ? " Test card: 4111 1111 1111 1111, any future date, any CVC." : ""}
        </p>
      </section>
    </Shell>
  );
}
