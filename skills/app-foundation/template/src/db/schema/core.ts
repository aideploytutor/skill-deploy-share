import { jsonb, pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

/**
 * core_events — how systems talk to each other (see AGENTS.md "Events").
 * A system records what happened ("orders.paid"); other systems read it.
 * Never update another system's tables directly.
 */
export const coreEvents = pgTable(
  "core_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // "<system>.<event>", e.g. "orders.paid"
    source: text("source").notNull(), // skill that emitted it, e.g. "orders-core"
    subjectId: text("subject_id"), // id of the thing it is about, e.g. an order id
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("core_events_type_idx").on(t.type, t.createdAt)],
);
