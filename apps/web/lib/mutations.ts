import type { CreateConfigInput } from "@robertn702/webmcp-cafe-schema";
import { configs, tools } from "@webmcp-cafe/db";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";

// neon-http has no transactions; inserts are sequential. Acceptable for v1 —
// a failed tool insert leaves an empty config the owner can PATCH or re-POST.

export async function insertConfig(
  input: CreateConfigInput,
  contributorId: string,
): Promise<string> {
  const [row] = await db
    .insert(configs)
    .values({
      domain: input.domain,
      urlPattern: input.urlPattern,
      pageType: input.pageType,
      title: input.title,
      description: input.description,
      tags: input.tags,
      minEngine: input.minEngine,
      contributorId,
    })
    .returning({ id: configs.id });
  if (!row) throw new Error("Config insert returned no row");
  await insertTools(row.id, input.tools);
  return row.id;
}

async function insertTools(
  configId: string,
  toolInputs: CreateConfigInput["tools"],
): Promise<void> {
  await db.insert(tools).values(
    toolInputs.map((tool) => ({
      configId,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      execution: tool.execution,
    })),
  );
}

/**
 * Replace a config's tools and bump its version. Snapshots cascade-delete with
 * the old tool rows, so edited tools always drop back to unverified.
 */
export async function replaceTools(
  configId: string,
  toolInputs: CreateConfigInput["tools"],
): Promise<void> {
  await db.delete(tools).where(eq(tools.configId, configId));
  await insertTools(configId, toolInputs);
  await db
    .update(configs)
    .set({ version: sql`${configs.version} + 1`, updatedAt: new Date() })
    .where(eq(configs.id, configId));
}
