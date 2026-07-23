import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as apikeySchema from "./apikey-schema.js";
import * as authSchema from "./auth-schema.js";
import * as cafeSchema from "./cafe-schema.js";
import * as communitySchema from "./community-schema.js";

export * from "./apikey-schema.js";
export * from "./auth-schema.js";
export * from "./cafe-schema.js";
export * from "./community-schema.js";

export const schema = {
  ...authSchema,
  ...apikeySchema,
  ...cafeSchema,
  ...communitySchema,
};

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
