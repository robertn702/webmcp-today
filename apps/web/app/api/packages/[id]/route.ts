import { updatePackageMetaSchema } from "@webmcp-today/schema";
import { packages } from "@webmcp-today/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { updatePackageMeta } from "@/lib/mutations";
import { getPackageById } from "@/lib/packages-repo";

type Context = { params: Promise<{ id: string }> };

/** GET /api/packages/:id — the package at its latest version. */
export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const pkg = await getPackageById(id);
  if (!pkg) return jsonError(404, "Package not found");
  return NextResponse.json(pkg);
}

/**
 * PATCH /api/packages/:id — owner-only metadata edit (title/description).
 * `domain` is immutable after creation: it never moves, so it can never
 * escape the scope its published versions' urlPatterns/api already declare.
 */
export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const rows = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, "Package not found");
  if (existing.contributorId !== userId) return jsonError(403, "Only the contributor may edit");

  const body = await parseBody(request, updatePackageMetaSchema);
  if (!body.ok) return body.response;

  await updatePackageMeta(id, body.data);

  const updated = await getPackageById(id);
  return NextResponse.json(updated);
}
