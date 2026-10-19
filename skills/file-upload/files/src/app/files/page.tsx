import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDbConfigured } from "@/db";
import { authSetupMissing, getCurrentUser } from "@/lib/auth";
import { UPLOAD_LIMITS, getUsage, isStorageConfigured, listFiles, userFolder } from "@/lib/storage";
import { removeFile } from "./actions";
import Uploader from "./uploader";

export const metadata: Metadata = { title: "My files" };
export const dynamic = "force-dynamic";

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : mb(n));

function Setup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-16">
      <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">file-upload</span>
      <h1 className="text-3xl font-black">{title}</h1>
      <div className="flex flex-col gap-3 text-muted">{children}</div>
    </main>
  );
}

export default async function FilesPage() {
  if (!isDbConfigured()) return <Setup title="Uploads need a database">Install db-connect first (episode 003).</Setup>;
  if (authSetupMissing().length) return <Setup title="Uploads need sign-in">Finish auth-login first (episode 006): only signed-in users can upload.</Setup>;
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login?next=/files");
  if (!isStorageConfigured()) {
    return (
      <Setup title="Storage isn't connected yet">
        <p>The site owner needs to connect a free Blob store in Vercel:</p>
        <ol className="list-decimal pl-5">
          <li>Project → <b>Storage</b> → <b>Create</b> → <b>Blob</b></li>
          <li>Choose <b>Public</b> access and tick <b>Add a read-write token env var</b>, then <b>Create</b></li>
          <li><b>Deployments</b> → <b>Redeploy</b></li>
        </ol>
        <p>This adds <code>BLOB_READ_WRITE_TOKEN</code> automatically. Nobody needs to copy any key.</p>
      </Setup>
    );
  }

  const [files, usage] = await Promise.all([listFiles(user.id), getUsage(user.id)]);
  const room = UPLOAD_LIMITS.maxBytesPerUser - usage.bytes;
  const full = usage.files >= UPLOAD_LIMITS.maxFilesPerUser || room <= 0;
  const pct = Math.min(100, Math.round((usage.bytes / UPLOAD_LIMITS.maxBytesPerUser) * 100));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">file-upload</span>
        <h1 className="text-3xl font-black">My files</h1>
        <p className="text-muted">Files are kept in cloud storage, not inside the website, so a new deploy never wipes them.</p>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold">Your space</span>
          <span className="tabular-nums text-muted">
            {usage.files}/{UPLOAD_LIMITS.maxFilesPerUser} files · {size(usage.bytes)} of {mb(UPLOAD_LIMITS.maxBytesPerUser)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <Uploader folder={userFolder(user.id)} types={UPLOAD_LIMITS.types} maxFileBytes={UPLOAD_LIMITS.maxFileBytes} roomBytes={Math.max(0, room)} full={full} />

      {files.length === 0 ? (
        <p className="text-center text-muted">No files yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {files.map((f) => (
            <li key={f.id} className="flex flex-col overflow-hidden rounded-2xl border border-line">
              <a href={f.url} target="_blank" rel="noreferrer" className="flex aspect-square items-center justify-center bg-line/40">
                {f.contentType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} loading="lazy" className="size-full object-cover" />
                ) : (
                  <span className="text-4xl" aria-hidden>📄</span>
                )}
              </a>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" title={f.name}>{f.name}</p>
                  <p className="text-xs tabular-nums text-muted">{size(f.size)}</p>
                </div>
                <form action={removeFile}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="rounded-full border border-line px-3 py-1 text-xs font-bold transition active:scale-95" aria-label={`Delete ${f.name}`}>
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        Only signed-in users can upload, only into their own folder. Limits: {mb(UPLOAD_LIMITS.maxFileBytes)} per file, {UPLOAD_LIMITS.maxFilesPerUser} files and {mb(UPLOAD_LIMITS.maxBytesPerUser)} per person.{" "}
        <Link href="/account" className="underline underline-offset-4">My account</Link>
      </p>
    </main>
  );
}
