import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { jsonError } from "@/lib/http";
import { lookupConfigs, lookupInstalledConfigs } from "@/lib/lookup";

/**
 * GET /api/configs/lookup?url=<page url>[&installed=true]
 * Default: configs matching the URL at their latest version, most specific
 * first. `installed=true` (requires auth) instead returns the caller's
 * installed configs pinned to their installs.versionId.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return jsonError(400, "Missing required query param: url");

  if (searchParams.get("installed") === "true") {
    const userId = await getAuthUserId(request);
    if (!userId) return jsonError(401, "Authentication required for installed=true");
    const configs = await lookupInstalledConfigs(userId, url);
    return NextResponse.json({ configs });
  }

  const configs = await lookupConfigs(url);
  return NextResponse.json({ configs });
}
