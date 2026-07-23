import { createDb } from "@webmcp-cafe/db";
import { env } from "@/env";

export const db = createDb(env.DATABASE_URL);
