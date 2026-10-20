import { cache } from "react";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb, isDbConfigured } from "@/db";
import { authAccounts, authRateLimits, authSessions, authUsers, authVerifications } from "@/db/schema";
import { emitEvent } from "@/lib/events";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import stack from "../../stack.json";

/**
 * auth-login (episode 006): sign in with Google, or with a 6-digit code sent by email.
 * Built on Better Auth: users live in YOUR database (auth_* tables), no per-user fees.
 */
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || stack.name || "My Site";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** What is still missing before sign-in works. Empty array = ready. */
export function authSetupMissing(): string[] {
  const missing: string[] = [];
  if (!isDbConfigured()) missing.push("DATABASE_URL");
  if (!process.env.BETTER_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");
  if (!isEmailConfigured() && !isGoogleConfigured()) missing.push("RESEND_API_KEY / GOOGLE_CLIENT_ID");
  return missing;
}

function createAuth() {
  return betterAuth({
    appName: siteName,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        rateLimit: authRateLimits,
      },
    }),
    socialProviders: isGoogleConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            prompt: "select_account",
          },
        }
      : {},
    // Same email via Google and via email code = the same user.
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    session: { expiresIn: 60 * 60 * 24 * 30 }, // stay signed in for 30 days
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        // One code per 60 s per visitor: each code costs an email (Resend free tier: 100/day).
        "/email-otp/send-verification-otp": { window: 60, max: 1 },
        "/sign-in/email-otp": { window: 60, max: 10 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await emitEvent({ type: "auth.user_created", source: "auth-login", subjectId: user.id, payload: {} }).catch(() => {});
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        async sendVerificationOTP({ email, otp }) {
          const r = await sendEmail({
            to: email,
            tag: "login-code",
            subject: `${otp} is your ${siteName} sign-in code`,
            text: `Your sign-in code is ${otp}. It works for 5 minutes.\nIf you didn't ask for it, you can ignore this email.`,
            html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6">
              <p>Your ${siteName} sign-in code:</p>
              <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:12px 0">${otp}</p>
              <p style="color:#666">It works for 5 minutes. If you didn't ask for it, you can ignore this email.</p>
            </div>`,
          });
          if (!r.ok) throw new Error(r.error);
        },
      }),
      nextCookies(), // must stay last
    ],
  });
}

let cached: ReturnType<typeof createAuth> | null = null;
// Cloudflare Workers can't reuse a database connection across requests, so there the
// auth instance (which holds one) is made per request. Elsewhere one instance is kept.
const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
const perRequest = cache(createAuth);

/** Created on first use, so `next build` works before the database or secrets exist. */
export function getAuth() {
  if (onWorkers) return perRequest();
  return (cached ??= createAuth());
}

/** The signed-in user on the server, or null. */
export async function getCurrentUser(reqHeaders: Headers) {
  if (authSetupMissing().length) return null;
  const s = await getAuth().api.getSession({ headers: reqHeaders });
  return s?.user ?? null;
}
