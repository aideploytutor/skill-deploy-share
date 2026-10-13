import { defineConfig } from "drizzle-kit";

// Used by `npm run db:generate` / `db:migrate` once DATABASE_URL is set (episode 003: db-connect).
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
