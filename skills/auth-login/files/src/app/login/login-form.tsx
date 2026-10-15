"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const COOLDOWN = 60; // seconds before another code can be sent (the server enforces it too)

const MESSAGES: Record<string, string> = {
  INVALID_OTP: "验证码不对，检查一下再输入。",
  OTP_EXPIRED: "验证码过期了，重新获取一个。",
  TOO_MANY_ATTEMPTS: "输错太多次，重新获取一个验证码。",
};

export default function LoginForm({ next, google, email }: { next: string; google: boolean; email: boolean }) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function explain(err: { code?: string; status?: number; message?: string } | null) {
    if (!err) return "";
    if (err.status === 429) return "操作太频繁了，等一分钟再试。";
    return ((err.code && MESSAGES[err.code]) || err.message || "出了点问题，请再试一次。") + (err.code ? `（${err.code}）` : "");
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (wait > 0) return;
    setBusy(true); setMsg("");
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: address.trim(), type: "sign-in" });
    setBusy(false);
    if (error) return setMsg(explain(error));
    setStep("code");
    setCode("");
    setWait(COOLDOWN);
    setMsg(`验证码已发到 ${address.trim()}，5 分钟内有效。没收到就看看垃圾箱。`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await authClient.signIn.emailOtp({ email: address.trim(), otp: code.trim() });
    setBusy(false);
    if (error) return setMsg(explain(error));
    router.replace(next);
    router.refresh();
  }

  async function withGoogle() {
    setBusy(true); setMsg("");
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" });
    if (error) { setBusy(false); setMsg(explain(error)); }
  }

  const input = "w-full rounded-xl border border-line bg-transparent px-4 py-3 text-base";
  const primary = "w-full rounded-full bg-accent px-6 py-3 font-bold text-white transition active:scale-95 disabled:opacity-40";

  return (
    <div className="flex flex-col gap-6">
      {google && (
        <button type="button" onClick={withGoogle} disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-line px-6 py-3 font-bold transition active:scale-95 disabled:opacity-40">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-16.6z"/>
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/>
          </svg>
          用 Google 登录
        </button>
      )}
      {google && email && (
        <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />或者用邮箱<span className="h-px flex-1 bg-line" /></div>
      )}
      {email && step === "email" && (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="login-email" className="text-sm font-bold">邮箱</label>
          <input id="login-email" type="email" required autoComplete="email" value={address}
            onChange={(e) => setAddress(e.target.value)} placeholder="name@example.com" className={input} />
          <button type="submit" disabled={busy || wait > 0} className={primary}>{busy ? "发送中…" : wait > 0 ? `${wait} 秒后可重新发送` : "发送验证码"}</button>
        </form>
      )}
      {email && step === "code" && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label htmlFor="login-code" className="text-sm font-bold">6 位验证码</label>
          <input id="login-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${input} text-center text-2xl font-black tracking-[0.5em] tabular-nums`} />
          <button type="submit" disabled={busy || code.length !== 6} className={primary}>{busy ? "登录中…" : "登录"}</button>
          <div className="flex justify-center gap-5 text-sm text-muted">
            <button type="button" onClick={() => sendCode()} disabled={busy || wait > 0} className="underline underline-offset-4 disabled:no-underline disabled:opacity-60">
              {wait > 0 ? `${wait} 秒后可重新发送` : "重新发送验证码"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); setMsg(""); }} className="underline underline-offset-4">
              换个邮箱
            </button>
          </div>
        </form>
      )}
      {msg && <p className="text-sm text-muted" aria-live="polite">{msg}</p>}
    </div>
  );
}
