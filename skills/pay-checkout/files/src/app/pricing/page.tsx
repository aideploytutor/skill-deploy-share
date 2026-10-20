import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDbConfigured } from "@/db";
import { authSetupMissing, getCurrentUser } from "@/lib/auth";
import { formatMoney, getProduct, isPayConfigured, listPayments, payMode, startCheckout } from "@/lib/pay";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

const PRODUCT_ID = process.env.CREEM_PRODUCT_ID ?? "";

async function buy() {
  "use server";
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/pricing");
  const url = await startCheckout({ id: user.id, email: user.email }, PRODUCT_ID);
  redirect(url);
}

function Setup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-16">
      <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">pay-checkout</span>
      <h1 className="text-3xl font-black">{title}</h1>
      <div className="flex flex-col gap-3 text-muted">{children}</div>
    </main>
  );
}

export default async function PricingPage() {
  if (!isDbConfigured() || authSetupMissing().length) return <Setup title="Payments need a database and sign-in">Install db-connect (003) and auth-login (006) first.</Setup>;
  if (!isPayConfigured() || !PRODUCT_ID) {
    return (
      <Setup title="Payments aren't connected yet">
        <p>The site owner needs to add these in the host&apos;s settings (Cloudflare: Settings → Variables and Secrets):</p>
        <ul className="list-disc pl-5">
          <li><code>CREEM_API_KEY</code>: Creem → Developers → API key (use the test key first)</li>
          <li><code>CREEM_WEBHOOK_SECRET</code>: Creem → Developers → Webhooks</li>
          <li><code>CREEM_PRODUCT_ID</code>: the product to sell (starts with prod_)</li>
        </ul>
      </Setup>
    );
  }

  const user = await getCurrentUser(await headers());
  const [product, payments] = await Promise.all([getProduct(PRODUCT_ID), user ? listPayments(user.id) : Promise.resolve([])]);
  const test = payMode() === "test";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">pay-checkout</span>
          {test && <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">TEST MODE · no real money</span>}
        </div>
        <h1 className="text-3xl font-black">Pricing</h1>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-line p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">{product.name}</h2>
          <span className="text-3xl font-black tabular-nums">{formatMoney(product.price, product.currency)}</span>
        </div>
        {product.description && <p className="text-muted">{product.description}</p>}
        {user ? (
          <form action={buy}>
            <button type="submit" className="w-full rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95">
              Buy now
            </button>
          </form>
        ) : (
          <Link href="/login?next=/pricing" className="w-full rounded-full bg-accent px-6 py-3 text-center font-bold text-white">
            Sign in to buy
          </Link>
        )}
        <p className="text-xs text-muted">
          Secure checkout by Creem (merchant of record: it handles sales tax and receipts).
          {test ? " Test card: 4111 1111 1111 1111, any future date, any CVC." : ""}
        </p>
      </section>

      {payments.length > 0 && (
        <section className="rounded-2xl border border-line p-5">
          <h2 className="mb-3 font-bold">My payments</h2>
          <ol className="flex flex-col divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span>{p.status === "paid" ? "✅ Paid" : "⏳ Not completed"} <span className="text-muted">· {p.mode}</span></span>
                <span className="tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                <time className="shrink-0 tabular-nums text-muted">{p.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
