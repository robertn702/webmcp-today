import { domainCoveredByPatterns, updatePackageMetaSchema } from "@robertn702/webmcp-cafe-schema";
import { packages } from "@webmcp-cafe/db";
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

  // `domain` is the lookup key but urlPatterns live on the (version-scoped)
  // latest version, so a metadata PATCH can move `domain` off the patterns that
  // publish couldn't. Re-check coverage against the latest version's patterns.
  if (body.data.domain !== undefined) {
    const latest = await getLatestVersion(id);
    if (latest && !domainCoveredByPatterns(body.data.domain, latest.urlPatterns)) {
      return jsonError(
        422,
        `domain "${body.data.domain}" is not covered by this package's urlPatterns, so it would be unreachable by lookup.`,
      );
    }
  }

  await updatePackageMeta(id, body.data);

  const updated = await getPackageById(id);
  return NextResponse.json(updated);
}
