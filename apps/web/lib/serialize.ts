import type { WebMcpPackage } from "@webmcp-today/schema";
import type { packages, packageVersions } from "@webmcp-today/db";

type PackageRow = typeof packages.$inferSelect;
type VersionRow = typeof packageVersions.$inferSelect;

/** Serialize a package + one of its versions to the public WebMcpPackage shape. */
export function serializePackage(
  pkg: PackageRow,
  version: VersionRow,
  opts: { contributorName?: string },
): WebMcpPackage {
  return {
    id: pkg.id,
    versionId: version.id,
    domain: pkg.domain,
    urlPatterns: version.urlPatterns,
    ...(pkg.pageType ? { pageType: pkg.pageType } : {}),
    title: pkg.title,
    description: pkg.description,
    tools: version.tools,
    api: version.api,
    minEngine: version.minEngine,
    ...(version.apiContentHash ? { apiContentHash: version.apiContentHash } : {}),
    ...(version.changelog ? { changelog: version.changelog } : {}),
    contributor: opts.contributorName ?? pkg.contributorId,
    version: version.version,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}
