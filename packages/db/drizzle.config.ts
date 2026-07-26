import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/*-schema.ts",
  out: "./migrations",
  dbCredentials: {
    // drizzle-kit generate works offline; migrate/push need the real URL.
    // Prefer the unpooled host — schema migrations shouldn't run through
    // PgBouncer. `neon env pull` writes both; DATABASE_URL is the -pooler one.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "postgres://placeholder",
  },
});
