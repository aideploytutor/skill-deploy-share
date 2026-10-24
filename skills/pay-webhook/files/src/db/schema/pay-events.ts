import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * pay-webhook (episode 012): every notification Creem sends, kept once.
 * The id is Creem's event id (evt_...), so a retried or resent event is recognised and never handled twice.
 * status: received → processed | ignored | failed (failed ones are retried by the reconcile job).
 */
export const payEvents = pgTable(
  "pay_events",
  {
    id: text("id").primaryKey(), // Creem event id
    type: text("type").notNull(), // e.g. "checkout.completed", "refund.created"
    status: text("status").notNull().default("received"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    deliveries: integer("deliveries").notNull().default(1), // how many times Creem sent it
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("pay_events_status_idx").on(t.status, t.receivedAt)],
);
