import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | null = null;

/** True once DATABASE_URL is set (episode 003: db-connect). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * The shared database client. Standard Postgres, so any provider works
 * (Neon, Supabase, your own server) — switching is a change of DATABASE_URL only.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Install the db-connect skill (episode 003) to connect a database.",
    );
  }
  const client = postgres(url, { prepare: false, max: 5 });
  cached = drizzle(client, { schema });
  return cached;
}
