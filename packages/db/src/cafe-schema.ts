import type {
  ExecutionDescriptor,
  InputSchema,
  ToolAnnotations,
} from "@robertn702/webmcp-cafe-schema";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export const configs = pgTable(
  "configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    urlPattern: text("url_pattern").notNull(),
    pageType: text("page_type"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    tags: jsonb("tags").$type<string[]>(),
    minEngine: text("min_engine"),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_configs_domain").on(t.domain),
    uniqueIndex("uq_configs_domain_url").on(t.domain, t.urlPattern),
  ],
);

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id")
      .notNull()
      .references(() => configs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    inputSchema: jsonb("input_schema").$type<InputSchema>().notNull(),
    annotations: jsonb("annotations").$type<ToolAnnotations>(),
    execution: jsonb("execution").$type<ExecutionDescriptor>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_tools_config_id").on(t.configId),
    uniqueIndex("uq_tools_config_name").on(t.configId, t.name),
  ],
);
