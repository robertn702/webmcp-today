import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { lookupConfigs } from "@/lib/lookup";

/**
 * GET /api/configs/lookup?url=<page url>[&yolo=true]
 * Returns configs matching the URL, most specific first. Verified tools only
 * (served from their verification snapshots) unless yolo=true.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return jsonError(400, "Missing required query param: url");
  const yolo = searchParams.get("yolo") === "true";
  const configs = await lookupConfigs(url, yolo);
  return NextResponse.json({ configs });
}
