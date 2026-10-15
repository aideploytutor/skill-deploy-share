"use client";
import { useState } from "react";

/** Makes a random BETTER_AUTH_SECRET in the owner's own browser. It is never sent anywhere. */
export default function SecretMaker() {
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  function make() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setSecret(btoa(String.fromCharCode(...bytes)));
    setCopied(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(secret); setCopied(true); } catch { /* select it by hand */ }
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line p-5">
      <h2 className="font-bold">生成 BETTER_AUTH_SECRET</h2>
      <p className="text-sm text-muted">在你自己的浏览器里随机生成，不会发到任何地方。复制后粘贴到 Vercel，打开 Sensitive，然后重新部署。别发给任何人，包括 AI。</p>
      {secret ? (
        <>
          <code className="break-all rounded-xl border border-line p-3 text-sm select-all">{secret}</code>
          <button type="button" onClick={copy} className="w-fit rounded-full bg-accent px-5 py-2 font-bold text-white">{copied ? "已复制" : "复制"}</button>
        </>
      ) : (
        <button type="button" onClick={make} className="w-fit rounded-full bg-accent px-5 py-2 font-bold text-white">生成一个</button>
      )}
    </section>
  );
}
