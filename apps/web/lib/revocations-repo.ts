import { revocations } from "@webmcp-today/db";
import { asc, gt, sql } from "drizzle-orm";
import { db } from "./db";

export type RevocationRow = {
  id: number;
  packageId: string;
  versionId: string | null;
  reason: string;
  revokedAt: Date;
};

/** One poll's worth; a client that hits the cap re-polls with its new cursor. */
const DEFAULT_LIMIT = 500;

/**
 * Revocations after `cursor`, oldest first. Ascending is load-bearing: the
 * client advances its cursor to the last id it saw, so a capped page has to be
 * a contiguous prefix of what it hasn't seen yet, never a newest-first slice.
 */
export function listRevocationsSince(
  cursor: number,
  limit: number = DEFAULT_LIMIT,
): Promise<RevocationRow[]> {
  return db
    .select({
      id: revocations.id,
      packageId: revocations.packageId,
      versionId: revocations.versionId,
      reason: revocations.reason,
      revokedAt: revocations.revokedAt,
    })
    .from(revocations)
    .where(gt(revocations.id, cursor))
    .orderBy(asc(revocations.id))
    .limit(limit);
}

/**
 * The table's current max id (0 if empty) — the server's ground truth for
 * whether a client's stored cursor is still valid. Computed explicitly rather
 * than reading the last row of a possibly-capped or possibly-empty page,
 * which gives the wrong answer for both.
 */
export async function getLatestRevocationId(): Promise<number> {
  const [row] = await db
    .select({ latest: sql<number>`coalesce(max(${revocations.id}), 0)` })
    .from(revocations);
  // sql<number> is a type-only annotation — pg's max(bigserial) arrives as a
  // raw string, so coerce before the route serializes it.
  return Number(row?.latest ?? 0);
}
