import type { ApiBlock, ToolDescriptor } from "@robertn702/webmcp-cafe-schema";
import {
  bigserial,
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
export const packages = pgTable(
  "packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    pageType: text("page_type"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_packages_domain").on(t.domain)],
);

/**
 * Append-only: publishing a new version never mutates an old one. Served
 * truth — there is no separate snapshot table. Browse/fresh lookups serve
 * max(version); installed users stay pinned via `installs.versionId`.
 */
export const packageVersions = pgTable(
  "package_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    urlPatterns: jsonb("url_patterns").$type<string[]>().notNull(),
    tools: jsonb("tools").$type<ToolDescriptor[]>().notNull(),
    /** Tier-1 API execution surface for this version's API-mode tools (see docs/api-execution-model.md). */
    api: jsonb("api").$type<ApiBlock>(),
    /**
     * Content identifier for `api` (apiContentHash in packages/schema) — null
     * exactly when `api` is null. The same surface recurs across a package's
     * versions and across rival packages targeting the same site, so this is
     * the dedupe key clients store one copy under.
     */
    apiContentHash: text("api_content_hash"),
    /** Capability floor this version's content requires (see engineLevelSchema in packages/schema). */
    minEngine: integer("min_engine"),
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_package_versions_package_id").on(t.packageId),
    unique("uq_package_versions_package_version").on(t.packageId, t.version),
  ],
);

/**
 * Auth-only per-user installs; double duty as the trust signal (COUNT/GROUP
 * BY package_id, derived at query time — no counter cache).
 */
export const installs = pgTable(
  "installs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => packageVersions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.packageId] })],
);

/**
 * Append-only kill list, polled by clients with `id` as the cursor. Once
 * installed package bodies live in the extension's storage the registry is off
 * the read path, so this is the only lever it keeps after install
 * (docs/local-first-installs.md §5). Writes are hand-run SQL in v1 — there is
 * no admin role and no write endpoint.
 *
 * `id` is a bigserial rather than this schema's usual `uuid().defaultRandom()`
 * precisely because it is that cursor: a random uuid is not monotonic.
 */
export const revocations = pgTable("revocations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "cascade" }),
  /** Null revokes the whole package; otherwise only this version. */
  versionId: uuid("version_id").references(() => packageVersions.id),
  /** Short, and shown to the user — a package never silently vanishes. */
  reason: text("reason").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }).notNull().defaultNow(),
  revokedBy: text("revoked_by").references(() => user.id),
});
