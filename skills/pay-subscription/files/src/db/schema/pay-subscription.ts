import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { payPayments } from "./pay";

/**
 * pay-subscription (episode 013): one row per Creem subscription.
 * Creem charges the card every month; webhooks keep status and current_period_end up to date,
 * and access lasts until current_period_end (plus a short grace period while a renewal is retried).
 */
export const paySubscriptions = pgTable(
  "pay_subscriptions",
  {
    id: text("id").primaryKey(), // Creem subscription id, sub_...
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    customerId: text("customer_id"), // Creem customer, for the self-service portal
    status: text("status").notNull(), // active | trialing | past_due | scheduled_cancel | canceled | expired | unpaid | paused | refunded
    mode: text("mode").notNull(), // test | live
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    renewals: integer("renewals").notNull().default(0),
    firstPaymentId: uuid("first_payment_id").references(() => payPayments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pay_subscriptions_user_idx").on(t.userId, t.productId)],
);
