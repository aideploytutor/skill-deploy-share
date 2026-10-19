"use client";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveUpload } from "./actions";

type Props = { folder: string; types: string[]; maxFileBytes: number; roomBytes: number; full: boolean };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`;

/** Keep file names readable and safe in a URL: letters, numbers, dot, dash, underscore. */
function cleanName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  return ext ? `${base}.${ext}` : base;
}

export default function Uploader({ folder, types, maxFileBytes, roomBytes, full }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!types.includes(file.type)) return setMsg({ ok: false, text: "This file type isn't allowed. Use JPG, PNG, WebP, GIF or PDF." });
    if (file.size > maxFileBytes) return setMsg({ ok: false, text: `That file is ${mb(file.size)}. The limit is ${mb(maxFileBytes)} per file.` });
    if (file.size > roomBytes) return setMsg({ ok: false, text: `Not enough space left (${mb(roomBytes)}). Delete a file first.` });
    setBusy(true);
    setProgress(0);
    try {
      const blob = await upload(folder + cleanName(file.name), file, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      const r = await saveUpload(blob.url);
      setMsg(r.ok ? { ok: true, text: "Uploaded. It's saved in storage, so deploys won't wipe it." } : { ok: false, text: r.error || "Saved to storage, but not to the list. Reload the page." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: `Upload failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center transition hover:border-accent ${busy || full ? "pointer-events-none opacity-50" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files[0]); }}
      >
        <span className="text-3xl" aria-hidden>⬆</span>
        <span className="font-bold">{busy ? `Uploading… ${progress}%` : full ? "Storage full: delete a file first" : "Choose a file or drop it here"}</span>
        <span className="text-sm text-muted">JPG, PNG, WebP, GIF or PDF · up to {mb(maxFileBytes)}</span>
        <input ref={input} type="file" accept={types.join(",")} className="sr-only" disabled={busy || full} onChange={(e) => onPick(e.target.files?.[0])} />
      </label>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-accent/10" : "border border-line"}`}>{msg.ok ? "✅ " : "⚠️ "}{msg.text}</p>}
    </div>
  );
}
