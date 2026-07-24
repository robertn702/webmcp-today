import type { WebMcpConfig } from "@robertn702/webmcp-cafe-schema";
import type { definitionVersions, webmcpDefinitions } from "@webmcp-cafe/db";

type DefinitionRow = typeof webmcpDefinitions.$inferSelect;
type VersionRow = typeof definitionVersions.$inferSelect;

/** Serialize a definition + one of its versions to the public WebMcpConfig shape. */
export function serializeConfig(
  definition: DefinitionRow,
  version: VersionRow,
  opts: { contributorName?: string; installCount?: number },
): WebMcpConfig {
  return {
    id: definition.id,
    versionId: version.id,
    domain: definition.domain,
    urlPatterns: version.urlPatterns,
    ...(definition.pageType ? { pageType: definition.pageType } : {}),
    title: definition.title,
    description: definition.description,
    tools: version.tools,
    ...(definition.tags ? { tags: definition.tags } : {}),
    ...(version.minEngine ? { minEngine: version.minEngine } : {}),
    ...(version.changelog ? { changelog: version.changelog } : {}),
    contributor: opts.contributorName ?? definition.contributorId,
    version: version.version,
    ...(opts.installCount !== undefined ? { installCount: opts.installCount } : {}),
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}
