import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { payPayments } from "./pay";

/**
 * pay-webhook (episode 012): every Creem notification, written down once.
 * The id is Creem's event id, so a notification delivered twice is handled once.
 */
export const payWebhookEvents = pgTable(
  "pay_webhook_events",
  {
    id: text("id").primaryKey(), // Creem event id, e.g. evt_...
    type: text("type").notNull(), // checkout.completed, refund.created, ...
    status: text("status").notNull().default("received"), // received → done | ignored | failed
    paymentId: uuid("payment_id"),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("pay_webhook_events_received_idx").on(t.receivedAt)],
);

/**
 * pay-webhook (episode 012): what a payment unlocks. One row per paid payment.
 * Refunds and chargebacks set revoked_at, so access goes away by itself.
 */
export const payGrants = pgTable(
  "pay_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    paymentId: uuid("payment_id").notNull().unique().references(() => payPayments.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"), // refunded | disputed
  },
  (t) => [index("pay_grants_user_idx").on(t.userId, t.productId)],
);
