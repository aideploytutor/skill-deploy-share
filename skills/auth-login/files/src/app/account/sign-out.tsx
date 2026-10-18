"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => { await authClient.signOut(); router.replace("/login"); router.refresh(); }}
      className="w-fit rounded-full border border-line px-6 py-3 font-bold transition active:scale-95"
    >
      Sign out
    </button>
  );
}
