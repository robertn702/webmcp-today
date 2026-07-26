import { boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { authDbSchema, user } from "./auth-schema";

// better-auth apiKey plugin table (agents authenticate uploads with Bearer keys).
//
// The export stays `apikey` — the plugin hardcodes that as its model name
// (`API_KEY_TABLE_NAME`) and the drizzle adapter resolves it as a `schema[model]`
// property read. The SQL name is ours to pick; see auth-schema.ts for the split.
// Lives in the `auth` namespace with the core tables: `key` is credential
// material, which is the whole point of the boundary.

export const apikey = authDbSchema.table("api_keys", {
  id: text("id").primaryKey(),
  configId: text("config_id").notNull().default("default"),
  name: text("name"),
  start: text("start"),
  referenceId: text("reference_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  prefix: text("prefix"),
  key: text("key").notNull(),
  refillInterval: integer("refill_interval"),
  refillAmount: integer("refill_amount"),
  lastRefillAt: timestamp("last_refill_at"),
  enabled: boolean("enabled").notNull().default(true),
  rateLimitEnabled: boolean("rate_limit_enabled").notNull().default(true),
  rateLimitTimeWindow: integer("rate_limit_time_window"),
  rateLimitMax: integer("rate_limit_max"),
  requestCount: integer("request_count").notNull().default(0),
  remaining: integer("remaining"),
  lastRequest: timestamp("last_request"),
  expiresAt: timestamp("expires_at"),
  permissions: text("permissions"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
