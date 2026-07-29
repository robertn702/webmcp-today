import { publishVersionSchema } from "@robertn702/webmcp-today-schema";
import { packages } from "@webmcp-today/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { acceptedSubmission, jsonError, parseBody } from "@/lib/http";
import { publishVersion } from "@/lib/mutations";
import { listVersions } from "@/lib/packages-repo";

/**
 * GET /api/packages/:id/versions — this package's versions, newest first.
 * Public: update and rollback both need the list, and neither is account-scoped.
 *
 * Publishing always writes version 1, so an empty list means the package
 * doesn't exist rather than "no versions yet" — hence the 404 without a second
 * query.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const versions = await listVersions(id);
  if (versions.length === 0) return jsonError(404, "Package not found");
  return NextResponse.json({ versions });
}

/**
 * POST /api/packages/:id/versions — publish the next version of an existing
 * package (owner only). Versions are append-only; there is no edit or delete.
 * Installed users stay pinned to their current version until they explicitly
 * move their install pin.
 *
 * A version is a submission of its own, so it carries the same grant as a first
 * publish and the 201 links back to /terms.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const rows = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, "Package not found");
  if (existing.contributorId !== userId) {
    return jsonError(403, "Only the contributor may publish new versions");
  }

  const body = await parseBody(request, publishVersionSchema);
  if (!body.ok) return body.response;

  const { versionId, version } = await publishVersion(id, body.data);
  return acceptedSubmission(
    request,
    { versionId, version },
    `/api/packages/${id}/versions/${versionId}`,
  );
}
