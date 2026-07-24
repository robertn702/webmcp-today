import type { ToolDescriptor } from "@robertn702/webmcp-cafe-schema";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Package-level metadata. No uniqueness on domain (or domain + pattern) by
 * design: rival packages may target the same site — installs + specificity
 * rank them instead of a first-come registration.
 */
export const webmcpDefinitions = pgTable(
  "webmcp_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    pageType: text("page_type"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    tags: jsonb("tags").$type<string[]>(),
    minEngine: text("min_engine"),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_webmcp_definitions_domain").on(t.domain)],
);

/**
 * Append-only: publishing a new version never mutates an old one. Served
 * truth — there is no separate snapshot table. Browse/fresh lookups serve
 * max(version); installed users stay pinned via `installs.versionId`.
 */
export const definitionVersions = pgTable(
  "definition_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => webmcpDefinitions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    urlPatterns: jsonb("url_patterns").$type<string[]>().notNull(),
    tools: jsonb("tools").$type<ToolDescriptor[]>().notNull(),
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_definition_versions_definition_id").on(t.definitionId),
    unique("uq_definition_versions_definition_version").on(t.definitionId, t.version),
  ],
);

/**
 * Auth-only per-user installs; double duty as the trust signal (COUNT/GROUP
 * BY definition_id, derived at query time — no counter cache).
 */
export const installs = pgTable(
  "installs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => webmcpDefinitions.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => definitionVersions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.definitionId] })],
);
