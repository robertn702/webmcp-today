import { configs, votes } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

/** POST /api/configs/:id/vote — upvote (+1) or downvote (-1); upserts per user. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = await getAuthUserId(request);
  if (!userId) return jsonError(401, "Authentication required");

  const body = await parseBody(request, voteSchema);
  if (!body.ok) return body.response;

  const exists = await db
    .select({ id: configs.id })
    .from(configs)
    .where(eq(configs.id, id))
    .limit(1);
  if (exists.length === 0) return jsonError(404, "Config not found");

  await db
    .insert(votes)
    .values({ userId, configId: id, value: body.data.value })
    .onConflictDoUpdate({
      target: [votes.userId, votes.configId],
      set: { value: body.data.value },
    });

  return NextResponse.json({ ok: true });
}
