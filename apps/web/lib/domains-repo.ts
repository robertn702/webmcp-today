import { packages } from "@webmcp-today/db";
import { asc, sql } from "drizzle-orm";
import { db } from "./db";

/** Every domain with at least one published package, alphabetical. */
export function listDistinctDomains(): Promise<string[]> {
  return db
    .selectDistinct({ domain: packages.domain })
    .from(packages)
    .orderBy(asc(packages.domain))
    .then((rows) => rows.map((row) => row.domain));
}

/**
 * Epoch ms of the corpus's most recent change (0 if there are no packages) —
 * the `version` a client's poll compares against its stored copy.
 */
export async function getDomainsVersion(): Promise<number> {
  const [row] = await db
    .select({ latest: sql<Date | null>`max(${packages.updatedAt})` })
    .from(packages);
  return row?.latest ? new Date(row.latest).getTime() : 0;
}
