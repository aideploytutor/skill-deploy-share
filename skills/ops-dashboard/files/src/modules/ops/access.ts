import { getCurrentUser } from "@/lib/auth";

/**
 * ops-dashboard (episode 015): who may open /ops.
 * - OPS_ADMIN_EMAILS: your sign-in email(s), comma separated. Only they see the dashboard.
 * - OPS_DASHBOARD_PUBLIC=true: anyone can see it (numbers only, never emails). Use it for demos only.
 */
export type OpsAccess = { ok: true; public: boolean } | { ok: false; reason: "notSet" | "signIn" | "notOwner" };

export function adminEmails(): string[] {
  return (process.env.OPS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function opsAccess(reqHeaders: Headers): Promise<OpsAccess> {
  if (process.env.OPS_DASHBOARD_PUBLIC === "true") return { ok: true, public: true };
  const admins = adminEmails();
  if (!admins.length) return { ok: false, reason: "notSet" };
  const user = await getCurrentUser(reqHeaders).catch(() => null);
  if (!user) return { ok: false, reason: "signIn" };
  return admins.includes(user.email.toLowerCase()) ? { ok: true, public: false } : { ok: false, reason: "notOwner" };
}
