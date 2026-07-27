import { packages } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { installPackage, uninstallPackage } from "@/lib/mutations";
import { getLatestVersion, getVersionById } from "@/lib/packages-repo";

const installBodySchema = z.object({ versionId: z.string().optional() });

/**
 * PUT /api/packages/:id/install — set the caller's pin (pinned to latest, or a
 * given versionId). Idempotent: creates the pin if absent, moves it if present
 * — the same call rollback uses, passing an older versionId. Auth-only.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const exists = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.id, id))
    .limit(1);
  if (exists.length === 0) return jsonError(404, "Package not found");

  const body = await parseBody(request, installBodySchema);
  if (!body.ok) return body.response;

  const version = body.data.versionId
    ? await getVersionById(id, body.data.versionId)
    : await getLatestVersion(id);
  if (!version) return jsonError(404, "Version not found for this package");

  await installPackage(userId, id, version.id);
  return NextResponse.json({ ok: true, versionId: version.id, version: version.version });
}

/** DELETE /api/packages/:id/install — uninstall. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const removed = await uninstallPackage(userId, id);
  if (!removed) return jsonError(404, "Not installed");
  return NextResponse.json({ ok: true });
}
