import { revocations } from "@webmcp-cafe/db";
import { asc, gt } from "drizzle-orm";
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
