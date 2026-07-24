import type {
  CreateConfigInput,
  PublishVersionInput,
  UpdateDefinitionMetaInput,
} from "@robertn702/webmcp-cafe-schema";
import { definitionVersions, installs, webmcpDefinitions } from "@webmcp-cafe/db";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";

// neon-http has no transactions; inserts are sequential. Acceptable for v1 —
// a failed version insert leaves a definition with no versions, invisible to
// lookup/browse (hydrateConfigs drops definitions without a version).

export async function insertDefinition(
  input: CreateConfigInput,
  contributorId: string,
): Promise<{ definitionId: string; versionId: string }> {
  const [definition] = await db
    .insert(webmcpDefinitions)
    .values({
      domain: input.domain,
      pageType: input.pageType,
      title: input.title,
      description: input.description,
      tags: input.tags,
      minEngine: input.minEngine,
      contributorId,
    })
    .returning({ id: webmcpDefinitions.id });
  if (!definition) throw new Error("Definition insert returned no row");

  const [version] = await db
    .insert(definitionVersions)
    .values({
      definitionId: definition.id,
      version: 1,
      urlPatterns: input.urlPatterns,
      tools: input.tools,
      changelog: input.changelog,
    })
    .returning({ id: definitionVersions.id });
  if (!version) throw new Error("Version insert returned no row");

  return { definitionId: definition.id, versionId: version.id };
}

/** Metadata-only edit (webmcp_definitions row) — never touches versions. */
export async function updateDefinitionMeta(
  definitionId: string,
  meta: UpdateDefinitionMetaInput,
): Promise<void> {
  if (Object.keys(meta).length === 0) return;
  await db
    .update(webmcpDefinitions)
    .set({ ...meta, updatedAt: new Date() })
    .where(eq(webmcpDefinitions.id, definitionId));
}

/** Append-only: insert the next version for an existing definition. */
export async function publishVersion(
  definitionId: string,
  input: PublishVersionInput,
): Promise<{ versionId: string; version: number }> {
  const [row] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${definitionVersions.version}), 0)` })
    .from(definitionVersions)
    .where(eq(definitionVersions.definitionId, definitionId));
  const nextVersion = (row?.maxVersion ?? 0) + 1;

  const [version] = await db
    .insert(definitionVersions)
    .values({
      definitionId,
      version: nextVersion,
      urlPatterns: input.urlPatterns,
      tools: input.tools,
      changelog: input.changelog,
    })
    .returning({ id: definitionVersions.id });
  if (!version) throw new Error("Version insert returned no row");

  await db
    .update(webmcpDefinitions)
    .set({ updatedAt: new Date() })
    .where(eq(webmcpDefinitions.id, definitionId));

  return { versionId: version.id, version: nextVersion };
}

/** Install (or move an existing install to) a specific version. Upserts per user+definition. */
export async function installDefinition(
  userId: string,
  definitionId: string,
  versionId: string,
): Promise<void> {
  await db
    .insert(installs)
    .values({ userId, definitionId, versionId })
    .onConflictDoUpdate({
      target: [installs.userId, installs.definitionId],
      set: { versionId, updatedAt: new Date() },
    });
}

export async function uninstallDefinition(userId: string, definitionId: string): Promise<boolean> {
  const deleted = await db
    .delete(installs)
    .where(and(eq(installs.userId, userId), eq(installs.definitionId, definitionId)))
    .returning({ userId: installs.userId });
  return deleted.length > 0;
}

/** Move an existing install's pin to a different version (update, or rollback). */
export async function updateInstallVersion(
  userId: string,
  definitionId: string,
  versionId: string,
): Promise<boolean> {
  const updated = await db
    .update(installs)
    .set({ versionId, updatedAt: new Date() })
    .where(and(eq(installs.userId, userId), eq(installs.definitionId, definitionId)))
    .returning({ userId: installs.userId });
  return updated.length > 0;
}
