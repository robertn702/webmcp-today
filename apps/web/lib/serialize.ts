import type { WebMcpPackage } from "@robertn702/webmcp-cafe-schema";
import type { packages, packageVersions } from "@webmcp-cafe/db";

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
    ...(version.api ? { api: version.api } : {}),
    ...(version.apiContentHash ? { apiContentHash: version.apiContentHash } : {}),
    ...(version.minEngine ? { minEngine: version.minEngine } : {}),
    ...(version.changelog ? { changelog: version.changelog } : {}),
    contributor: opts.contributorName ?? pkg.contributorId,
    version: version.version,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}
