import { markPaid, verifyWebhook } from "@/lib/pay";

/**
 * pay-checkout (episode 010). Creem calls this after a payment.
 * Register https://<your-domain>/api/pay/webhook in Creem → Developers → Webhooks,
 * and put its signing secret in CREEM_WEBHOOK_SECRET.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text(); // the signature covers the exact raw body
  if (!(await verifyWebhook(raw, request.headers.get("creem-signature")))) {
    return new Response("invalid signature", { status: 401 });
  }
  const event = JSON.parse(raw) as { eventType?: string; object?: Parameters<typeof markPaid>[0] };
  if (event.eventType === "checkout.completed" && event.object) {
    await markPaid(event.object);
  }
  return new Response("ok"); // 200 stops Creem's retries
}
