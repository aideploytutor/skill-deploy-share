import { verifyWebhook } from "@/lib/pay";
import { handleSubscriptionEvent } from "@/lib/pay-subscription";
import { handleCreemEvent } from "@/lib/pay-webhook";

/**
 * pay-checkout (010) + pay-webhook (012) + pay-subscription (013). Creem calls this after payments,
 * renewals, cancellations, refunds and chargebacks. Register https://<your-domain>/api/pay/webhook
 * in Creem → Developers → Webhooks, and put its signing secret in CREEM_WEBHOOK_SECRET.
 *
 * 200 = handled (or already handled before); 500 = something failed, Creem will try again.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text(); // the signature covers the exact raw body
  if (!(await verifyWebhook(raw, request.headers.get("creem-signature")))) {
    return new Response("invalid signature", { status: 401 });
  }
  let event: Parameters<typeof handleCreemEvent>[0];
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  try {
    const result = await handleCreemEvent(event, [handleSubscriptionEvent]);
    return Response.json({ ok: true, result });
  } catch (e) {
    console.error("[pay-webhook] failed", event.eventType, event.id, e);
    return new Response("failed, please retry", { status: 500 });
  }
}
