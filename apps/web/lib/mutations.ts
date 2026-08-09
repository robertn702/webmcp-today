import type {
  CreatePackageInput,
  PublishVersionInput,
  UpdatePackageMetaInput,
} from "@webmcp-today/schema";
import { installs, packages, packageVersions } from "@webmcp-today/db";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { isUniqueViolation, VersionConflictError } from "./http";

// neon-http has no transactions; inserts are sequential. Acceptable for v1 —
// a failed version insert leaves a package with no versions, invisible to
// lookup/browse (hydratePackages drops packages without a version).

export async function insertPackage(
  input: CreatePackageInput,
  contributorId: string,
): Promise<{ packageId: string; versionId: string }> {
  // Versions are author-declared: a new package must declare version 1.
  if (input.version !== 1) throw new VersionConflictError(1);

  const [pkg] = await db
    .insert(packages)
    .values({
      domain: input.domain,
      title: input.title,
      description: input.description,
      contributorId,
    })
    .returning({ id: packages.id });
  if (!pkg) throw new Error("Package insert returned no row");

  const [version] = await db
    .insert(packageVersions)
    .values({
      packageId: pkg.id,
      version: input.version,
      urlPatterns: input.urlPatterns,
      tools: input.tools,
      api: input.api,
      minEngine: input.minEngine,
      changelog: input.changelog,
    })
    .returning({ id: packageVersions.id });
  if (!version) throw new Error("Version insert returned no row");

  return { packageId: pkg.id, versionId: version.id };
}

/** Metadata-only edit (packages row) — never touches versions. */
export async function updatePackageMeta(
  packageId: string,
  meta: UpdatePackageMetaInput,
): Promise<void> {
  if (Object.keys(meta).length === 0) return;
  await db.update(packages).set(meta).where(eq(packages.id, packageId));
}

/** Append-only: insert the author-declared next version for an existing package.
 *
 * The declared version must equal `max(version)+1` exactly — a mismatch means
 * the author based their change on a stale snapshot (optimistic concurrency).
 * neon-http has no transactions, so the max read and the insert are separate
 * round-trips: two concurrent publishes can both declare the same number and
 * race for `uq_package_versions_package_version`. The loser's unique
 * violation maps to the same conflict as a stale declaration. */
export async function publishVersion(
  packageId: string,
  input: PublishVersionInput,
): Promise<{ versionId: string; version: number }> {
  const maxVersion = await readMaxVersion(packageId);
  const expectedVersion = maxVersion + 1;
  if (input.version !== expectedVersion) throw new VersionConflictError(expectedVersion);

  let version: { id: string } | undefined;
  try {
    [version] = await db
      .insert(packageVersions)
      .values({
        packageId,
        version: input.version,
        urlPatterns: input.urlPatterns,
        tools: input.tools,
        api: input.api,
        minEngine: input.minEngine,
        changelog: input.changelog,
      })
      .returning({ id: packageVersions.id });
  } catch (err) {
    // A concurrent publish took this number between our max read and insert.
    if (isUniqueViolation(err)) {
      throw new VersionConflictError((await readMaxVersion(packageId)) + 1);
    }
    throw err;
  }
  if (!version) throw new Error("Version insert returned no row");

  // Deliberate touch (not a redundant write): bumps the parent row so browse
  // ordering (orderBy(desc(packages.updatedAt)) in packages-repo.ts) surfaces
  // newly-versioned packages. The mdt_packages trigger overwrites this value
  // with now() anyway; an empty SET would be invalid SQL, so this stays.
  await db.update(packages).set({ updatedAt: new Date() }).where(eq(packages.id, packageId));

  return { versionId: version.id, version: input.version };
}

async function readMaxVersion(packageId: string): Promise<number> {
  const [row] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${packageVersions.version}), 0)` })
    .from(packageVersions)
    .where(eq(packageVersions.packageId, packageId));
  return row?.maxVersion ?? 0;
}

/**
 * Set (create or move) the caller's install pin to a specific version.
 * Upserts per user+package — also how rollback works (pass an older versionId).
 */
export async function installPackage(
  userId: string,
  packageId: string,
  versionId: string,
): Promise<void> {
  await db
    .insert(installs)
    .values({ userId, packageId, versionId })
    .onConflictDoUpdate({
      target: [installs.userId, installs.packageId],
      set: { versionId },
    });
}

export async function uninstallPackage(userId: string, packageId: string): Promise<boolean> {
  const deleted = await db
    .delete(installs)
    .where(and(eq(installs.userId, userId), eq(installs.packageId, packageId)))
    .returning({ userId: installs.userId });
  return deleted.length > 0;
}
