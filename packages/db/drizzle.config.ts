import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/*-schema.ts",
  out: "./migrations",
  // Defaults to ["public"], which would make introspect/push blind to the
  // better-auth tables in `auth` (packages/db/src/auth-schema.ts).
  schemaFilter: ["public", "auth"],
  dbCredentials: {
    // drizzle-kit generate works offline; migrate/push need the real URL.
    // Prefer the unpooled host — schema migrations shouldn't run through
    // PgBouncer. `neon env pull` writes both; DATABASE_URL is the -pooler one.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "postgres://placeholder",
  },
});
