import {
  apiContentHash,
  type CreatePackageInput,
  type PublishVersionInput,
  type UpdatePackageMetaInput,
} from "@robertn702/webmcp-today-schema";
import { installs, packages, packageVersions } from "@webmcp-today/db";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { isUniqueViolation } from "./http";

// neon-http has no transactions; inserts are sequential. Acceptable for v1 —
// a failed version insert leaves a package with no versions, invisible to
// lookup/browse (hydratePackages drops packages without a version).

export async function insertPackage(
  input: CreatePackageInput,
  contributorId: string,
): Promise<{ packageId: string; versionId: string }> {
  const [pkg] = await db
    .insert(packages)
    .values({
      domain: input.domain,
      pageType: input.pageType,
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
      version: 1,
      urlPatterns: input.urlPatterns,
      tools: input.tools,
      api: input.api,
      apiContentHash: input.api ? apiContentHash(input.api) : null,
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

/** Append-only: insert the next version for an existing package.
 *
 * neon-http has no transactions, so `max(version)+1` and the insert are separate
 * round-trips: two concurrent publishes can read the same max and race for
 * `uq_package_versions_package_version`. The loser hits a unique violation
 * rather than a 500 — re-read the max and retry the next number. */
const PUBLISH_MAX_ATTEMPTS = 3;

export async function publishVersion(
  packageId: string,
  input: PublishVersionInput,
): Promise<{ versionId: string; version: number }> {
  // Depends only on the api block, so it survives a collision retry unchanged.
  const contentHash = input.api ? apiContentHash(input.api) : null;

  for (let attempt = 1; attempt <= PUBLISH_MAX_ATTEMPTS; attempt++) {
    const [row] = await db
      .select({ maxVersion: sql<number>`coalesce(max(${packageVersions.version}), 0)` })
      .from(packageVersions)
      .where(eq(packageVersions.packageId, packageId));
    const nextVersion = (row?.maxVersion ?? 0) + 1;

    let version: { id: string } | undefined;
    try {
      [version] = await db
        .insert(packageVersions)
        .values({
          packageId,
          version: nextVersion,
          urlPatterns: input.urlPatterns,
          tools: input.tools,
          api: input.api,
          apiContentHash: contentHash,
          minEngine: input.minEngine,
          changelog: input.changelog,
        })
        .returning({ id: packageVersions.id });
    } catch (err) {
      // A concurrent publish took this number; re-read the max and try again.
      if (isUniqueViolation(err) && attempt < PUBLISH_MAX_ATTEMPTS) continue;
      throw err;
    }
    if (!version) throw new Error("Version insert returned no row");

    // Deliberate touch (not a redundant write): bumps the parent row so browse
    // ordering (orderBy(desc(packages.updatedAt)) in packages-repo.ts) surfaces
    // newly-versioned packages. The mdt_packages trigger overwrites this value
    // with now() anyway; an empty SET would be invalid SQL, so this stays.
    await db.update(packages).set({ updatedAt: new Date() }).where(eq(packages.id, packageId));

    return { versionId: version.id, version: nextVersion };
  }
  // Unreachable: the loop returns on success and throws on the final attempt.
  throw new Error("publishVersion: exhausted version-collision retries");
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
