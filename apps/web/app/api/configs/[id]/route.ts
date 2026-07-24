import { updateDefinitionMetaSchema } from "@robertn702/webmcp-cafe-schema";
import { webmcpDefinitions } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { getConfigById } from "@/lib/configs-repo";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { updateDefinitionMeta } from "@/lib/mutations";

type Context = { params: Promise<{ id: string }> };

/** GET /api/configs/:id — the definition at its latest version. */
export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const config = await getConfigById(id);
  if (!config) return jsonError(404, "Config not found");
  return NextResponse.json(config);
}

/** PATCH /api/configs/:id — owner-only metadata edit (domain/title/description/tags/…). */
export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const rows = await db
    .select()
    .from(webmcpDefinitions)
    .where(eq(webmcpDefinitions.id, id))
    .limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, "Config not found");
  if (existing.contributorId !== userId) return jsonError(403, "Only the contributor may edit");

  const body = await parseBody(request, updateDefinitionMetaSchema);
  if (!body.ok) return body.response;

  await updateDefinitionMeta(id, body.data);

  const updated = await getConfigById(id);
  return NextResponse.json(updated);
}
