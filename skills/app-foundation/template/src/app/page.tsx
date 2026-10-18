import Link from "next/link";
import { getStackStatus } from "@/lib/stack";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "__APP_NAME__";

export default function Home() {
  const status = getStackStatus();
  const done = status.steps.filter((s) => s.done).length;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-5 py-16 sm:py-24">
      <header className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">
          Foundation ready · app-foundation
        </span>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{siteName}</h1>
        <p className="text-lg text-muted">
          This is your product foundation. Next, have your AI add features on top, one layer at a time: database, sign-in, payments, orders…
          Each step is one sentence.
        </p>
      </header>

      <section className="rounded-2xl border border-line p-5 sm:p-6" aria-labelledby="next">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="next" className="text-lg font-bold">Next steps</h2>
          <span className="text-sm tabular-nums text-muted">{done}/{status.steps.length} done</span>
        </div>
        <ol className="flex flex-col divide-y divide-line">
          {status.steps.map((s) => (
            <li key={s.skill} className="flex items-center gap-4 py-3">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  s.done ? "bg-accent text-white" : "border border-line text-muted"
                }`}
                aria-hidden
              >
                {s.done ? "✓" : s.episode.slice(1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.label}</div>
                <div className="text-sm text-muted">{s.hint}</div>
              </div>
              <code className="shrink-0 rounded-md bg-line/60 px-2 py-0.5 text-xs">{s.skill}</code>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <Link className="underline underline-offset-4" href="/status">Foundation status</Link>
        <Link className="underline underline-offset-4" href="/api/health">Health check</Link>
        <a className="underline underline-offset-4" href="https://github.com/aideploytutor/skill-deploy-share">
          skill-deploy-share
        </a>
      </footer>
    </main>
  );
}
