import { toolDescriptorSchema } from "@robertn702/webmcp-cafe-schema";
import { configs, tools, verificationSnapshots } from "@webmcp-cafe/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";

const verifySchema = z.object({ toolName: z.string().min(1) });

/**
 * POST /api/configs/:id/verify — snapshot a tool as verified. The snapshot is
 * what non-yolo consumers receive; later edits delete it (tools cascade).
 * v1 policy: any signed-in user except the contributor. Multi-reviewer later.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const body = await parseBody(request, verifySchema);
  if (!body.ok) return body.response;

  const configRows = await db.select().from(configs).where(eq(configs.id, id)).limit(1);
  const config = configRows[0];
  if (!config) return jsonError(404, "Config not found");
  if (config.contributorId === userId) {
    return jsonError(403, "Contributors cannot verify their own configs");
  }

  const toolRows = await db
    .select()
    .from(tools)
    .where(and(eq(tools.configId, id), eq(tools.name, body.data.toolName)))
    .limit(1);
  const tool = toolRows[0];
  if (!tool) return jsonError(404, "Tool not found on this config");

  const descriptor = toolDescriptorSchema.safeParse({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations ?? undefined,
    execution: tool.execution ?? undefined,
  });
  if (!descriptor.success) {
    return jsonError(422, "Stored tool no longer passes schema validation; fix it first");
  }

  await db.insert(verificationSnapshots).values({
    toolId: tool.id,
    configId: id,
    snapshot: descriptor.data,
    verifiedById: userId,
  });

  return NextResponse.json({ ok: true, verifiedToolName: tool.name });
}
