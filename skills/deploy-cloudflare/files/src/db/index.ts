import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/** True once DATABASE_URL is set (episode 003: db-connect). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/** On Cloudflare, use the Hyperdrive connection pool when one is bound (much faster), else DATABASE_URL. */
function workersUrl(): string | undefined {
  try {
    const env = getCloudflareContext().env as { HYPERDRIVE?: { connectionString: string } };
    if (env.HYPERDRIVE?.connectionString) return env.HYPERDRIVE.connectionString;
  } catch {
    // no Cloudflare context (e.g. at build time)
  }
  return process.env.DATABASE_URL;
}

function connect(): Db {
  const url = onWorkers ? workersUrl() : process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Install the db-connect skill (episode 003) to connect a database.",
    );
  }
  // Cloudflare Workers can't reuse a connection across requests, so there each
  // request gets its own small client. On Vercel/Node one shared pool is kept.
  const client = onWorkers
    ? postgres(url, { prepare: false, max: 5, fetch_types: false, idle_timeout: 5 })
    : postgres(url, { prepare: false, max: 5 });
  return drizzle(client, { schema });
}

let shared: Db | null = null;
const perRequest = cache(connect);

/**
 * The database client. Standard Postgres, so any provider works
 * (Neon, Supabase, your own server) — switching is a change of DATABASE_URL only.
 * Works on Vercel and on Cloudflare Workers (deploy-cloudflare, episode 009).
 */
export function getDb(): Db {
  if (onWorkers) return perRequest();
  return (shared ??= connect());
}
