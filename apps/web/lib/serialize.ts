import type { ToolDescriptor, WebMcpConfig } from "@robertn702/webmcp-cafe-schema";
import type { configs, tools, verificationSnapshots } from "@webmcp-cafe/db";

type ConfigRow = typeof configs.$inferSelect;
type ToolRow = typeof tools.$inferSelect;
type SnapshotRow = typeof verificationSnapshots.$inferSelect;

/**
 * Serialize a config row to the public WebMcpConfig shape.
 *
 * Trust model: verified tools are served from their verification snapshot, so
 * later edits can't silently change what verified consumers receive. Unverified
 * live tools are only served when `yolo` is set. Returns null when no tools
 * survive filtering.
 */
export function serializeConfig(
  config: ConfigRow,
  toolRows: ToolRow[],
  snapshotRows: SnapshotRow[],
  opts: { yolo: boolean; contributorName?: string },
): WebMcpConfig | null {
  const latestByTool = new Map<string, SnapshotRow>();
  for (const snap of snapshotRows) {
    if (snap.configId !== config.id) continue;
    const prev = latestByTool.get(snap.toolId);
    if (!prev || snap.createdAt > prev.createdAt) latestByTool.set(snap.toolId, snap);
  }

  const ownTools = toolRows.filter((t) => t.configId === config.id);
  const servedTools: ToolDescriptor[] = [];
  const verifiedToolNames: string[] = [];

  for (const tool of ownTools) {
    const snap = latestByTool.get(tool.id);
    if (snap) {
      servedTools.push(snap.snapshot);
      verifiedToolNames.push(snap.snapshot.name);
    } else if (opts.yolo) {
      servedTools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
        ...(tool.execution ? { execution: tool.execution } : {}),
      });
    }
  }

  if (servedTools.length === 0) return null;

  return {
    id: config.id,
    domain: config.domain,
    urlPattern: config.urlPattern,
    ...(config.pageType ? { pageType: config.pageType } : {}),
    title: config.title,
    description: config.description,
    tools: servedTools,
    ...(config.tags ? { tags: config.tags } : {}),
    ...(config.minEngine ? { minEngine: config.minEngine } : {}),
    contributor: opts.contributorName ?? config.contributorId,
    version: config.version,
    verified: verifiedToolNames.length > 0,
    verifiedToolNames,
    totalToolCount: ownTools.length,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}
