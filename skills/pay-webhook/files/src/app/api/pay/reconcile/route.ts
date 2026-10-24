import { isPayConfigured } from "@/lib/pay";
import { reconcile } from "@/lib/pay-webhook";

/**
 * pay-webhook (episode 012): catch up on payments whose notifications never arrived.
 * Called every hour by .github/workflows/pay-reconcile.yml. It needs no secret: it only asks
 * Creem about this site's own pending payments, records what Creem confirms, and runs at
 * most once every 5 minutes however often it's called.
 */
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  if (!isPayConfigured()) return Response.json({ ok: false, error: "payments not configured" }, { status: 503 });
  try {
    return Response.json({ ok: true, ...(await reconcile()) });
  } catch (e) {
    console.error("[pay-webhook] reconcile failed", e);
    return Response.json({ ok: false, error: "reconcile failed, see logs" }, { status: 500 });
  }
}
