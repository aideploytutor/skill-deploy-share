import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Every sign-in request goes through here (/api/auth/...). Google's redirect URI is
// https://<your-domain>/api/auth/callback/google
export async function GET(req: Request) {
  return toNextJsHandler(getAuth()).GET(req);
}
export async function POST(req: Request) {
  return toNextJsHandler(getAuth()).POST(req);
}
