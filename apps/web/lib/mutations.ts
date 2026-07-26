import {
  apiContentHash,
  type CreateConfigInput,
  type PublishVersionInput,
  type UpdateDefinitionMetaInput,
} from "@robertn702/webmcp-cafe-schema";
import { definitionVersions, installs, webmcpDefinitions } from "@webmcp-cafe/db";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { isUniqueViolation } from "./http";

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
      api: input.api,
      apiContentHash: input.api ? await apiContentHash(input.api) : null,
      minEngine: input.minEngine,
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

/** Append-only: insert the next version for an existing definition.
 *
 * neon-http has no transactions, so `max(version)+1` and the insert are separate
 * round-trips: two concurrent publishes can read the same max and race for
 * `uq_definition_versions_definition_version`. The loser hits a unique violation
 * rather than a 500 — re-read the max and retry the next number. */
const PUBLISH_MAX_ATTEMPTS = 3;

export async function publishVersion(
  definitionId: string,
  input: PublishVersionInput,
): Promise<{ versionId: string; version: number }> {
  // Depends only on the api block, so it survives a collision retry unchanged.
  const contentHash = input.api ? await apiContentHash(input.api) : null;

  for (let attempt = 1; attempt <= PUBLISH_MAX_ATTEMPTS; attempt++) {
    const [row] = await db
      .select({ maxVersion: sql<number>`coalesce(max(${definitionVersions.version}), 0)` })
      .from(definitionVersions)
      .where(eq(definitionVersions.definitionId, definitionId));
    const nextVersion = (row?.maxVersion ?? 0) + 1;

    let version: { id: string } | undefined;
    try {
      [version] = await db
        .insert(definitionVersions)
        .values({
          definitionId,
          version: nextVersion,
          urlPatterns: input.urlPatterns,
          tools: input.tools,
          api: input.api,
          apiContentHash: contentHash,
          minEngine: input.minEngine,
          changelog: input.changelog,
        })
        .returning({ id: definitionVersions.id });
    } catch (err) {
      // A concurrent publish took this number; re-read the max and try again.
      if (isUniqueViolation(err) && attempt < PUBLISH_MAX_ATTEMPTS) continue;
      throw err;
    }
    if (!version) throw new Error("Version insert returned no row");

    await db
      .update(webmcpDefinitions)
      .set({ updatedAt: new Date() })
      .where(eq(webmcpDefinitions.id, definitionId));

    return { versionId: version.id, version: nextVersion };
  }
  // Unreachable: the loop returns on success and throws on the final attempt.
  throw new Error("publishVersion: exhausted version-collision retries");
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
