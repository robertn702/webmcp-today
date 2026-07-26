import type { WebMcpConfig } from "@robertn702/webmcp-cafe-schema";
import { definitionVersions, installs, user, webmcpDefinitions } from "@webmcp-cafe/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { serializeConfig } from "./serialize";

type DefinitionRow = typeof webmcpDefinitions.$inferSelect;
type VersionRow = typeof definitionVersions.$inferSelect;

/** Highest-version row per definitionId. */
function pickLatestVersions(versionRows: VersionRow[]): Map<string, VersionRow> {
  const latest = new Map<string, VersionRow>();
  for (const row of versionRows) {
    const prev = latest.get(row.definitionId);
    if (!prev || row.version > prev.version) latest.set(row.definitionId, row);
  }
  return latest;
}

async function fetchContributorNames(contributorIds: string[]): Promise<Map<string, string>> {
  if (contributorIds.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, contributorIds));
  return new Map(rows.map((u) => [u.id, u.name]));
}

async function fetchInstallCounts(definitionIds: string[]): Promise<Map<string, number>> {
  if (definitionIds.length === 0) return new Map();
  const rows = await db
    .select({ definitionId: installs.definitionId, value: count() })
    .from(installs)
    .where(inArray(installs.definitionId, definitionIds))
    .groupBy(installs.definitionId);
  return new Map(rows.map((r) => [r.definitionId, r.value]));
}

/** Hydrate definitions with a caller-supplied version per definitionId (latest, or pinned). */
async function hydrate(
  definitionRows: DefinitionRow[],
  versionByDefinition: Map<string, VersionRow>,
): Promise<WebMcpConfig[]> {
  if (definitionRows.length === 0) return [];
  const ids = definitionRows.map((d) => d.id);
  const [names, installCounts] = await Promise.all([
    fetchContributorNames(definitionRows.map((d) => d.contributorId)),
    fetchInstallCounts(ids),
  ]);
  return definitionRows.flatMap((def) => {
    const version = versionByDefinition.get(def.id);
    if (!version) return [];
    return [
      serializeConfig(def, version, {
        contributorName: names.get(def.contributorId),
        installCount: installCounts.get(def.id) ?? 0,
      }),
    ];
  });
}

/** Hydrate definitions at each one's globally-latest version. */
export async function hydrateConfigs(definitionRows: DefinitionRow[]): Promise<WebMcpConfig[]> {
  const ids = definitionRows.map((d) => d.id);
  if (ids.length === 0) return [];
  const versionRows = await db
    .select()
    .from(definitionVersions)
    .where(inArray(definitionVersions.definitionId, ids));
  return hydrate(definitionRows, pickLatestVersions(versionRows));
}

export async function listConfigs(opts: {
  domain?: string;
  page: number;
  pageSize: number;
}): Promise<{ configs: WebMcpConfig[]; total: number }> {
  const where = opts.domain ? eq(webmcpDefinitions.domain, opts.domain) : undefined;
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(webmcpDefinitions)
      .where(where)
      .orderBy(desc(webmcpDefinitions.updatedAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ value: count() }).from(webmcpDefinitions).where(where),
  ]);
  return { configs: await hydrateConfigs(rows), total: totals[0]?.value ?? 0 };
}

export async function getConfigById(id: string): Promise<WebMcpConfig | null> {
  const rows = await db
    .select()
    .from(webmcpDefinitions)
    .where(eq(webmcpDefinitions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const hydrated = await hydrateConfigs([row]);
  return hydrated[0] ?? null;
}

export async function getLatestVersion(definitionId: string): Promise<VersionRow | null> {
  const rows = await db
    .select()
    .from(definitionVersions)
    .where(eq(definitionVersions.definitionId, definitionId))
    .orderBy(desc(definitionVersions.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVersionById(
  definitionId: string,
  versionId: string,
): Promise<VersionRow | null> {
  const rows = await db
    .select()
    .from(definitionVersions)
    .where(
      and(eq(definitionVersions.definitionId, definitionId), eq(definitionVersions.id, versionId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * One definition at an exact version — the served document, not the bare row
 * `getVersionById` returns. This is what an install fetches and keeps, so it has
 * to be the same shape browse and lookup serve.
 */
export async function getConfigAtVersion(
  definitionId: string,
  versionId: string,
): Promise<WebMcpConfig | null> {
  const [definitionRows, version] = await Promise.all([
    db.select().from(webmcpDefinitions).where(eq(webmcpDefinitions.id, definitionId)).limit(1),
    getVersionById(definitionId, versionId),
  ]);
  const definition = definitionRows[0];
  if (!definition || !version) return null;
  const hydrated = await hydrate([definition], new Map([[definition.id, version]]));
  return hydrated[0] ?? null;
}

export type VersionSummary = {
  versionId: string;
  version: number;
  changelog: string | null;
  createdAt: Date;
};

/** A definition's versions, newest first — what update and rollback choose from. */
export function listVersions(definitionId: string): Promise<VersionSummary[]> {
  return db
    .select({
      versionId: definitionVersions.id,
      version: definitionVersions.version,
      changelog: definitionVersions.changelog,
      createdAt: definitionVersions.createdAt,
    })
    .from(definitionVersions)
    .where(eq(definitionVersions.definitionId, definitionId))
    .orderBy(desc(definitionVersions.version));
}

/** A user's installed configs, each pinned to `installs.versionId`. */
export async function getInstalledConfigs(userId: string): Promise<WebMcpConfig[]> {
  const installRows = await db.select().from(installs).where(eq(installs.userId, userId));
  if (installRows.length === 0) return [];

  const definitionIds = installRows.map((i) => i.definitionId);
  const versionIds = installRows.map((i) => i.versionId);
  const [definitionRows, versionRows] = await Promise.all([
    db.select().from(webmcpDefinitions).where(inArray(webmcpDefinitions.id, definitionIds)),
    db.select().from(definitionVersions).where(inArray(definitionVersions.id, versionIds)),
  ]);

  const versionById = new Map(versionRows.map((v) => [v.id, v]));
  const pinnedByDefinition = new Map<string, VersionRow>();
  for (const install of installRows) {
    const version = versionById.get(install.versionId);
    if (version) pinnedByDefinition.set(install.definitionId, version);
  }
  return hydrate(definitionRows, pinnedByDefinition);
}
