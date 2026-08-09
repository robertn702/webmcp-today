import type { WebMcpPackageStrict } from "@webmcp-today/schema";
import type { packages, packageVersions } from "@webmcp-today/db";

type PackageRow = typeof packages.$inferSelect;
type VersionRow = typeof packageVersions.$inferSelect;

/**
 * Serialize a package + one of its versions to the public WebMcpPackage shape.
 * Returns the STRICT producer type (not the loose `WebMcpPackage` consumers
 * parse into) so a typo'd field here is a TS excess-property error — see
 * `webMcpPackageObjectSchema`'s doc comment in packages/schema/src/registry.ts.
 */
export function serializePackage(
  pkg: PackageRow,
  version: VersionRow,
  opts: { contributorName?: string },
): WebMcpPackageStrict {
  return {
    id: pkg.id,
    versionId: version.id,
    domain: pkg.domain,
    urlPatterns: version.urlPatterns,
    title: pkg.title,
    description: pkg.description,
    tools: version.tools,
    api: version.api,
    minEngine: version.minEngine,
    ...(version.changelog ? { changelog: version.changelog } : {}),
    contributor: opts.contributorName ?? pkg.contributorId,
    version: version.version,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}
