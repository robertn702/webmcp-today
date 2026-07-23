import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/*-schema.ts",
  out: "./migrations",
  dbCredentials: {
    // drizzle-kit generate works offline; migrate/push need the real URL.
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
});
