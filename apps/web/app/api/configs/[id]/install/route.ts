import { webmcpDefinitions } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/api-auth";
import { getLatestVersion, getVersionById } from "@/lib/configs-repo";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { installDefinition, uninstallDefinition } from "@/lib/mutations";

const installBodySchema = z.object({ versionId: z.string().optional() });

/** POST /api/configs/:id/install — install (pinned to latest, or a given versionId). Auth-only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const exists = await db
    .select({ id: webmcpDefinitions.id })
    .from(webmcpDefinitions)
    .where(eq(webmcpDefinitions.id, id))
    .limit(1);
  if (exists.length === 0) return jsonError(404, "Config not found");

  const body = await parseBody(request, installBodySchema);
  if (!body.ok) return body.response;

  const version = body.data.versionId
    ? await getVersionById(id, body.data.versionId)
    : await getLatestVersion(id);
  if (!version) return jsonError(404, "Version not found for this config");

  await installDefinition(userId, id, version.id);
  return NextResponse.json({ ok: true, versionId: version.id, version: version.version });
}

/** DELETE /api/configs/:id/install — uninstall. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const removed = await uninstallDefinition(userId, id);
  if (!removed) return jsonError(404, "Not installed");
  return NextResponse.json({ ok: true });
}
