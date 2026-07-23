import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as apikeySchema from "./apikey-schema";
import * as authSchema from "./auth-schema";
import * as cafeSchema from "./cafe-schema";
import * as communitySchema from "./community-schema";

export * from "./apikey-schema";
export * from "./auth-schema";
export * from "./cafe-schema";
export * from "./community-schema";

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
