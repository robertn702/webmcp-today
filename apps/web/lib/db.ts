import { createDb } from "@webmcp-today/db";
import { env } from "@/env";

export const db = createDb(env.DATABASE_URL);
