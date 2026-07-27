import type { WebMcpPackage } from "@robertn702/webmcp-cafe-schema";
import { installs, packages, packageVersions, user } from "@webmcp-cafe/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { serializePackage } from "./serialize";

type PackageRow = typeof packages.$inferSelect;
type VersionRow = typeof packageVersions.$inferSelect;

/** Highest-version row per packageId. */
function pickLatestVersions(versionRows: VersionRow[]): Map<string, VersionRow> {
  const latest = new Map<string, VersionRow>();
  for (const row of versionRows) {
    const prev = latest.get(row.packageId);
    if (!prev || row.version > prev.version) latest.set(row.packageId, row);
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

async function fetchInstallCounts(packageIds: string[]): Promise<Map<string, number>> {
  if (packageIds.length === 0) return new Map();
  const rows = await db
    .select({ packageId: installs.packageId, value: count() })
    .from(installs)
    .where(inArray(installs.packageId, packageIds))
    .groupBy(installs.packageId);
  return new Map(rows.map((r) => [r.packageId, r.value]));
}

/** Hydrate packages with a caller-supplied version per packageId (latest, or pinned). */
async function hydrate(
  packageRows: PackageRow[],
  versionByPackage: Map<string, VersionRow>,
): Promise<WebMcpPackage[]> {
  if (packageRows.length === 0) return [];
  const ids = packageRows.map((p) => p.id);
  const [names, installCounts] = await Promise.all([
    fetchContributorNames(packageRows.map((p) => p.contributorId)),
    fetchInstallCounts(ids),
  ]);
  return packageRows.flatMap((pkg) => {
    const version = versionByPackage.get(pkg.id);
    if (!version) return [];
    return [
      serializePackage(pkg, version, {
        contributorName: names.get(pkg.contributorId),
        installCount: installCounts.get(pkg.id) ?? 0,
      }),
    ];
  });
}

/** Hydrate packages at each one's globally-latest version. */
export async function hydratePackages(packageRows: PackageRow[]): Promise<WebMcpPackage[]> {
  const ids = packageRows.map((p) => p.id);
  if (ids.length === 0) return [];
  const versionRows = await db
    .select()
    .from(packageVersions)
    .where(inArray(packageVersions.packageId, ids));
  return hydrate(packageRows, pickLatestVersions(versionRows));
}

export async function listPackages(opts: {
  domain?: string;
  page: number;
  pageSize: number;
}): Promise<{ packages: WebMcpPackage[]; total: number }> {
  const where = opts.domain ? eq(packages.domain, opts.domain) : undefined;
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(packages)
      .where(where)
      .orderBy(desc(packages.updatedAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ value: count() }).from(packages).where(where),
  ]);
  return { packages: await hydratePackages(rows), total: totals[0]?.value ?? 0 };
}

export async function getPackageById(id: string): Promise<WebMcpPackage | null> {
  const rows = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const hydrated = await hydratePackages([row]);
  return hydrated[0] ?? null;
}

export async function getLatestVersion(packageId: string): Promise<VersionRow | null> {
  const rows = await db
    .select()
    .from(packageVersions)
    .where(eq(packageVersions.packageId, packageId))
    .orderBy(desc(packageVersions.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVersionById(
  packageId: string,
  versionId: string,
): Promise<VersionRow | null> {
  const rows = await db
    .select()
    .from(packageVersions)
    .where(and(eq(packageVersions.packageId, packageId), eq(packageVersions.id, versionId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * One package at an exact version — the served document, not the bare row
 * `getVersionById` returns. This is what an install fetches and keeps, so it has
 * to be the same shape browse and lookup serve.
 */
export async function getPackageAtVersion(
  packageId: string,
  versionId: string,
): Promise<WebMcpPackage | null> {
  const [packageRows, version] = await Promise.all([
    db.select().from(packages).where(eq(packages.id, packageId)).limit(1),
    getVersionById(packageId, versionId),
  ]);
  const pkg = packageRows[0];
  if (!pkg || !version) return null;
  const hydrated = await hydrate([pkg], new Map([[pkg.id, version]]));
  return hydrated[0] ?? null;
}

export type VersionSummary = {
  versionId: string;
  version: number;
  changelog: string | null;
  createdAt: Date;
};

/** A package's versions, newest first — what update and rollback choose from. */
export function listVersions(packageId: string): Promise<VersionSummary[]> {
  return db
    .select({
      versionId: packageVersions.id,
      version: packageVersions.version,
      changelog: packageVersions.changelog,
      createdAt: packageVersions.createdAt,
    })
    .from(packageVersions)
    .where(eq(packageVersions.packageId, packageId))
    .orderBy(desc(packageVersions.version));
}

/** A user's installed packages, each pinned to `installs.versionId`. */
export async function getInstalledPackages(userId: string): Promise<WebMcpPackage[]> {
  const installRows = await db.select().from(installs).where(eq(installs.userId, userId));
  if (installRows.length === 0) return [];

  const packageIds = installRows.map((i) => i.packageId);
  const versionIds = installRows.map((i) => i.versionId);
  const [packageRows, versionRows] = await Promise.all([
    db.select().from(packages).where(inArray(packages.id, packageIds)),
    db.select().from(packageVersions).where(inArray(packageVersions.id, versionIds)),
  ]);

  const versionById = new Map(versionRows.map((v) => [v.id, v]));
  const pinnedByPackage = new Map<string, VersionRow>();
  for (const install of installRows) {
    const version = versionById.get(install.versionId);
    if (version) pinnedByPackage.set(install.packageId, version);
  }
  return hydrate(packageRows, pinnedByPackage);
}
