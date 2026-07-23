import { createConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { listConfigs } from "@/lib/configs-repo";
import { isUniqueViolation, jsonError, parseBody } from "@/lib/http";
import { insertConfig } from "@/lib/mutations";

/** GET /api/configs?domain=&page=&pageSize=&yolo=true — browse the registry. */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const domain = searchParams.get("domain") ?? undefined;
  const yolo = searchParams.get("yolo") === "true";

  const { configs, total } = await listConfigs({ domain, page, pageSize, yolo });
  return NextResponse.json({ configs, total, page, pageSize });
}

/** POST /api/configs — submit a config (session cookie or Bearer API key). */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required (session or API key)");

  const body = await parseBody(request, createConfigSchema);
  if (!body.ok) return body.response;

  try {
    const id = await insertConfig(body.data, userId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return jsonError(409, "A config for this domain + urlPattern already exists");
    }
    throw err;
  }
}
