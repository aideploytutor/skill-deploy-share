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
      <h2 className="font-bold">Generate BETTER_AUTH_SECRET</h2>
      <p className="text-sm text-muted">Made randomly in your own browser and never sent anywhere. Copy it, paste it into Vercel, turn on Sensitive, then redeploy. Don't send it to anyone, including your AI.</p>
      {secret ? (
        <>
          <code className="break-all rounded-xl border border-line p-3 text-sm select-all">{secret}</code>
          <button type="button" onClick={copy} className="w-fit rounded-full bg-accent px-5 py-2 font-bold text-white">{copied ? "Copied" : "Copy"}</button>
        </>
      ) : (
        <button type="button" onClick={make} className="w-fit rounded-full bg-accent px-5 py-2 font-bold text-white">Generate</button>
      )}
    </section>
  );
}
