import type { Metadata } from "next";
import Link from "next/link";
import { confirmCheckout, formatMoney, isPayConfigured } from "@/lib/pay";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

/**
 * Creem sends buyers here after paying (?checkout_id=...&order_id=...&signature=...).
 * We don't trust the address bar: the checkout is looked up with Creem's API first.
 */
export default async function PaySuccess({ searchParams }: { searchParams: Promise<{ checkout_id?: string }> }) {
  const { checkout_id } = await searchParams;
  let state: "paid" | "pending" | "unknown" = "unknown";
  let amount = "";
  if (checkout_id && isPayConfigured()) {
    try {
      const c = await confirmCheckout(checkout_id);
      state = c.status === "completed" ? "paid" : "pending";
      amount = formatMoney(c.order?.amount, c.order?.currency);
    } catch {
      state = "unknown";
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-5 py-20 text-center">
      <span className="text-6xl" aria-hidden>{state === "paid" ? "🎉" : state === "pending" ? "⏳" : "🤔"}</span>
      <h1 className="text-3xl font-black">
        {state === "paid" ? "Payment received" : state === "pending" ? "Payment is processing" : "We couldn't find that payment"}
      </h1>
      <p className="text-muted">
        {state === "paid"
          ? `Thank you! ${amount} was paid. A receipt is on its way to your inbox.`
          : state === "pending"
            ? "This usually takes a few seconds. Refresh this page in a moment."
            : "If you were charged, contact us and include the email you paid with."}
      </p>
      <Link href="/pricing" className="rounded-full border border-line px-6 py-3 font-bold">Back to pricing</Link>
    </main>
  );
}
