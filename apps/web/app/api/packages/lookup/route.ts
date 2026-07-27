import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { lookupPackages } from "@/lib/lookup";

/**
 * GET /api/packages/lookup?url=<page url>
 * Packages matching the URL at their latest version, most specific first. A
 * dedicated cache/rate-limit surface, kept separate from `GET /api/packages`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return jsonError(400, "Missing required query param: url");

  const packages = await lookupPackages(url);
  return NextResponse.json({ packages });
}
