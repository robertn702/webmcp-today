import { packageWithinDomainScope, updatePackageMetaSchema } from "@robertn702/webmcp-today-schema";
import { packages } from "@webmcp-today/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { updatePackageMeta } from "@/lib/mutations";
import { getLatestVersion, getPackageById } from "@/lib/packages-repo";

type Context = { params: Promise<{ id: string }> };

/** GET /api/packages/:id — the package at its latest version. */
export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const pkg = await getPackageById(id);
  if (!pkg) return jsonError(404, "Package not found");
  return NextResponse.json(pkg);
}

/** PATCH /api/packages/:id — owner-only metadata edit (domain/title/description/pageType). */
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

  // `domain` is the visible scope but urlPatterns/api live on the version row,
  // so a metadata PATCH must not move a package outside its existing content.
  if (body.data.domain !== undefined) {
    const latest = await getLatestVersion(id);
    if (
      latest &&
      !packageWithinDomainScope({
        domain: body.data.domain,
        urlPatterns: latest.urlPatterns,
        ...(latest.api === null ? {} : { api: latest.api }),
      })
    ) {
      return jsonError(
        422,
        `domain "${body.data.domain}" does not scope this package's urlPatterns and api.baseUrl.`,
      );
    }
  }

  await updatePackageMeta(id, body.data);

  const updated = await getPackageById(id);
  return NextResponse.json(updated);
}
