import { NextResponse } from "next/server";
import { getConfigAtVersion } from "@/lib/configs-repo";
import { jsonError } from "@/lib/http";

/**
 * GET /api/configs/:id/versions/:versionId — the document served at that exact
 * version. Public and unauthenticated: nothing here is caller-specific, and a
 * pinned install has to be fetchable without an account.
 *
 * Every other read serves latest (`/api/configs`, `/api/configs/:id`) or the
 * caller's pins (`/api/configs/lookup?installed=true`); this is the only
 * version-addressed one.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
): Promise<NextResponse> {
  const { id, versionId } = await context.params;
  const config = await getConfigAtVersion(id, versionId);
  if (!config) return jsonError(404, "Config version not found");
  return NextResponse.json(config);
}
