import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

/**
 * file-upload (episode 008): one row per uploaded file.
 * The file itself lives in object storage (Vercel Blob); this table only keeps
 * its address, so listing files never costs a storage operation.
 */
export const filesUploads = pgTable(
  "files_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    url: text("url").notNull().unique(),
    pathname: text("pathname").notNull(),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_uploads_user_idx").on(t.userId, t.createdAt)],
);
