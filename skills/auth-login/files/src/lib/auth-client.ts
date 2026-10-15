"use client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/** Browser side of auth-login (episode 006). Same site, so no baseURL needed. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
