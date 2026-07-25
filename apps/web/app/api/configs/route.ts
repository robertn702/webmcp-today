import { createConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { listConfigs } from "@/lib/configs-repo";
import { acceptedSubmission, jsonError, parseBody } from "@/lib/http";
import { insertDefinition } from "@/lib/mutations";

/** GET /api/configs?domain=&page=&pageSize= — browse the registry (latest version of each). */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const domain = searchParams.get("domain") ?? undefined;

  const { configs, total } = await listConfigs({ domain, page, pageSize });
  return NextResponse.json({ configs, total, page, pageSize });
}

/**
 * POST /api/configs — publish a new definition + its version 1 (session cookie
 * or Bearer API key). Publishing here carries the same submission grant as the
 * form at /submit: a permanent license to host and redistribute the package,
 * offered onward under CC0. The 201 links back to /terms.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required (session or API key)");

  const body = await parseBody(request, createConfigSchema);
  if (!body.ok) return body.response;

  const { definitionId } = await insertDefinition(body.data, userId);
  return acceptedSubmission(request, { id: definitionId });
}
