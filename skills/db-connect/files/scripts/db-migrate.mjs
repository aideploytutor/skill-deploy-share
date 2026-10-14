// db-connect: apply database migrations from ./drizzle.
// Runs before every build (package.json "build"), and on demand with `npm run db:migrate`.
// Uses the direct (unpooled) connection when available, as Neon recommends for migrations.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("[db-migrate] DATABASE_URL is not set — skipping (connect a database with db-connect).");
  process.exit(0);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  const started = Date.now();
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log(`[db-migrate] Database is up to date (${Date.now() - started} ms).`);
} catch (err) {
  console.error(`[db-migrate] Failed: ${err?.message ?? err}`);
  console.error("[db-migrate] The build stops here so a broken database never goes live.");
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
