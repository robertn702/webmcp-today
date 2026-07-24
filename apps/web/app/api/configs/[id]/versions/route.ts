import { publishVersionSchema } from "@robertn702/webmcp-cafe-schema";
import { webmcpDefinitions } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { publishVersion } from "@/lib/mutations";

/**
 * POST /api/configs/:id/versions — publish the next version of an existing
 * definition (owner only). Versions are append-only; there is no edit or
 * delete. Installed users stay pinned to their current version until they
 * explicitly call /update.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const rows = await db
    .select()
    .from(webmcpDefinitions)
    .where(eq(webmcpDefinitions.id, id))
    .limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, "Config not found");
  if (existing.contributorId !== userId) {
    return jsonError(403, "Only the contributor may publish new versions");
  }

  const body = await parseBody(request, publishVersionSchema);
  if (!body.ok) return body.response;

  const { versionId, version } = await publishVersion(id, body.data);
  return NextResponse.json({ versionId, version }, { status: 201 });
}
