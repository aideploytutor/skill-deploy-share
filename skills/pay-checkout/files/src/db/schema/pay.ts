import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

/**
 * pay-checkout (episode 010): one row per checkout started on this site.
 * The payment itself happens on Creem (merchant of record); this table records
 * who paid for what, so other systems (orders, membership) can react.
 */
export const payPayments = pgTable(
  "pay_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(), // sent to Creem as request_id
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("creem"),
    mode: text("mode").notNull(), // "test" or "live"
    productId: text("product_id").notNull(),
    checkoutId: text("checkout_id").unique(),
    orderId: text("order_id"),
    status: text("status").notNull().default("pending"), // pending → paid
    amount: integer("amount"), // smallest currency unit, e.g. cents
    currency: text("currency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("pay_payments_user_idx").on(t.userId, t.createdAt)],
);
