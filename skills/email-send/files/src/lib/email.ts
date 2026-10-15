import { emitEvent } from "@/lib/events";

/**
 * email-send (episode 005): send email from your own domain.
 *
 * Uses Resend's plain HTTP API (no SDK), so it runs on Vercel and Cloudflare alike.
 * Swapping provider later means changing this one file.
 *
 *   const r = await sendEmail({ to: "a@b.com", subject: "你好", html: "<p>…</p>" });
 *   if (!r.ok) console.error(r.error);
 */
export type EmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** Short label for logs and Resend tags, e.g. "login-code", "receipt". Letters, numbers, - and _ only. */
  tag?: string;
  /** Same key within 24 h = Resend sends only once (safe retries). */
  idempotencyKey?: string;
};

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

/** True once RESEND_API_KEY and EMAIL_FROM are set (Vercel → Settings → Environment Variables). */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** "zhang@gmail.com" → "zh***@gmail.com": enough to recognise, not enough to leak. */
export function maskEmail(address: string): string {
  const [name, domain] = address.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    return { ok: false, error: "Email is not set up: add RESEND_API_KEY and EMAIL_FROM (episode 005, email-send)." };
  }
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const tag = input.tag?.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);

  let result: EmailResult;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined,
        tags: tag ? [{ name: "category", value: tag }] : undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    result = res.ok && body.id
      ? { ok: true, id: body.id }
      : { ok: false, error: `${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim() };
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Let other systems know (stored without the full address).
  await emitEvent({
    type: result.ok ? "email.sent" : "email.failed",
    source: "email-send",
    subjectId: result.ok ? result.id : undefined,
    payload: { to: to.map(maskEmail), subject: input.subject, tag: tag ?? null, ...(result.ok ? {} : { error: result.error }) },
  }).catch(() => {});

  return result;
}
