import { updateConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { configs } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/api-auth";
import { getConfigById } from "@/lib/configs-repo";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { replaceTools } from "@/lib/mutations";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const yolo = new URL(request.url).searchParams.get("yolo") === "true";
  const config = await getConfigById(id, yolo);
  if (!config) return jsonError(404, "Config not found");
  return NextResponse.json(config);
}

/** PATCH /api/configs/:id — owner only. Editing tools resets verification. */
export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const rows = await db.select().from(configs).where(eq(configs.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, "Config not found");
  if (existing.contributorId !== userId) return jsonError(403, "Only the contributor may edit");

  const body = await parseBody(request, updateConfigSchema);
  if (!body.ok) return body.response;
  const { tools: newTools, ...meta } = body.data;

  if (Object.keys(meta).length > 0) {
    await db
      .update(configs)
      .set({ ...meta, updatedAt: new Date() })
      .where(eq(configs.id, id));
  }
  if (newTools) await replaceTools(id, newTools);

  const updated = await getConfigById(id, true);
  return NextResponse.json(updated);
}
