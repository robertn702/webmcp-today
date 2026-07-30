import { createPackageSchema } from "@robertn702/webmcp-today-schema";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import {
  acceptedSubmission,
  jsonError,
  parseBody,
  VersionConflictError,
  versionConflict,
} from "@/lib/http";
import { insertPackage } from "@/lib/mutations";
import { listPackages } from "@/lib/packages-repo";

/** GET /api/packages?domain=&page=&pageSize= — browse the registry (latest version of each). */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const domain = searchParams.get("domain") ?? undefined;

  const { packages, total } = await listPackages({ domain, page, pageSize });
  return NextResponse.json({ packages, total, page, pageSize });
}

/**
 * POST /api/packages — publish a new package + its version 1 (session cookie
 * or Bearer API key). Publishing here carries the same submission grant as the
 * form at /submit: a permanent license to host and redistribute the package,
 * offered onward under CC0. The 201 links back to /terms.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required (session or API key)");

  const body = await parseBody(request, createPackageSchema);
  if (!body.ok) return body.response;

  try {
    const { packageId } = await insertPackage(body.data, userId);
    return acceptedSubmission(request, { id: packageId }, `/api/packages/${packageId}`);
  } catch (err) {
    if (err instanceof VersionConflictError) return versionConflict(err);
    throw err;
  }
}
