import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { jsonError } from "@/lib/http";
import { getInstalledPackages } from "@/lib/packages-repo";

/** GET /api/installs — the caller's pinned packages (session cookie or Bearer API key). */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const packages = await getInstalledPackages(userId);
  return NextResponse.json({ packages });
}
