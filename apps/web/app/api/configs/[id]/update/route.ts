import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/api-auth";
import { getLatestVersion, getVersionById } from "@/lib/configs-repo";
import { jsonError, parseBody } from "@/lib/http";
import { updateInstallVersion } from "@/lib/mutations";

const updateBodySchema = z.object({ versionId: z.string().optional() });

/**
 * POST /api/configs/:id/update — move the caller's install pin to a
 * different version (defaults to latest). Also serves as rollback: pass an
 * older versionId to move back.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const body = await parseBody(request, updateBodySchema);
  if (!body.ok) return body.response;

  const version = body.data.versionId
    ? await getVersionById(id, body.data.versionId)
    : await getLatestVersion(id);
  if (!version) return jsonError(404, "Version not found for this config");

  const moved = await updateInstallVersion(userId, id, version.id);
  if (!moved) return jsonError(404, "Not installed");
  return NextResponse.json({ ok: true, versionId: version.id, version: version.version });
}
