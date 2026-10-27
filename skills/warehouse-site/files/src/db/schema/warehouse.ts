import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * warehouse-site (episode 015): every inquiry a seller sends from /contact or /quote.
 * The owner works through them at /admin/inquiries (new → contacted → won / lost).
 */
export const warehouseInquiries = pgTable(
  "warehouse_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"), // WeChat / WhatsApp / phone, whatever the seller prefers
    company: text("company"), // store or company name
    platforms: text("platforms"), // "Amazon, TikTok Shop"
    monthlyOrders: text("monthly_orders"), // a range, e.g. "300-1000"
    message: text("message"),
    quote: jsonb("quote").$type<Record<string, unknown>>(), // the estimate the seller saw, if they came from /quote
    lang: text("lang").notNull().default("zh"),
    status: text("status").notNull().default("new"), // new → contacted → won | lost
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("warehouse_inquiries_created_idx").on(t.createdAt), index("warehouse_inquiries_email_idx").on(t.email, t.createdAt)],
);
