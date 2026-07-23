import type { ToolDescriptor } from "@robertn702/webmcp-cafe-schema";
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { configs, tools } from "./cafe-schema";

export const votes = pgTable(
  "votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => configs.id, { onDelete: "cascade" }),
    /** +1 or -1 */
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.configId] })],
);

/**
 * Per-tool verification snapshots: verifying freezes the tool descriptor, and
 * non-yolo consumers receive the snapshot — later edits can't silently change
 * what verified consumers get. One row per (tool, version); latest wins.
 */
export const verificationSnapshots = pgTable(
  "verification_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => configs.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").$type<ToolDescriptor>().notNull(),
    verifiedById: text("verified_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_snapshots_tool_id").on(t.toolId), index("idx_snapshots_config_id").on(t.configId)],
);
