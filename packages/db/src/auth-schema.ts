import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

// better-auth core tables (drizzle adapter, provider "pg"). Shapes follow
// better-auth's generated schema.
//
// These live in their own `auth` Postgres namespace rather than `public`, so
// the token-bearing tables (`accounts.access_token`, `api_keys.key`) sit behind
// a schema-level grant boundary and `public` stays app-owned. better-auth is
// indifferent: the adapter is handed the drizzle table object, which carries
// its own namespace.
//
// Two names are in play and only one of them is better-auth's business:
//   - The *export name* (`user`, `session`, …) is what better-auth resolves. The
//     drizzle adapter looks the model up as a plain `schema[model]` property
//     read against packages/db/src/index.ts's `schema` object, so these must
//     stay singular to match better-auth's model names. Renaming one throws
//     `[# Drizzle Adapter]: The model "user" was not found in the schema object`.
//   - The *SQL table name* (`users`, `sessions`, …) is drizzle's alone —
//     better-auth never sees it. Pluralized as house style, and because `user`
//     is a reserved word in Postgres (`SELECT * FROM user` is a syntax error
//     unquoted, which bites hand-run SQL and psql sessions).
// Column names are snake_case for the same reason: the adapter maps by TS
// property name, not column name.

/**
 * The `auth` namespace itself. Exported only so apikey-schema.ts can hang its
 * table off it — nothing reads it off the `schema` object in index.ts (drizzle
 * ignores non-table values there, and better-auth resolves models by key).
 */
export const authDbSchema = pgSchema("auth");

export const user = authDbSchema.table("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = authDbSchema.table("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = authDbSchema.table("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = authDbSchema.table("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
