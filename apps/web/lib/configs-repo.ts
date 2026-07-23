import type { WebMcpConfig } from "@robertn702/webmcp-cafe-schema";
import { configs, tools, user, verificationSnapshots } from "@webmcp-cafe/db";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { serializeConfig } from "./serialize";

type ConfigRow = typeof configs.$inferSelect;

export async function hydrateConfigs(
  configRows: ConfigRow[],
  yolo: boolean,
): Promise<WebMcpConfig[]> {
  const ids = configRows.map((c) => c.id);
  if (ids.length === 0) return [];
  const contributorIds = configRows.map((c) => c.contributorId);
  const [toolRows, snapshotRows, userRows] = await Promise.all([
    db.select().from(tools).where(inArray(tools.configId, ids)),
    db.select().from(verificationSnapshots).where(inArray(verificationSnapshots.configId, ids)),
    db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, contributorIds)),
  ]);
  const names = new Map(userRows.map((u) => [u.id, u.name]));
  return configRows.flatMap((row) => {
    const serialized = serializeConfig(row, toolRows, snapshotRows, {
      yolo,
      contributorName: names.get(row.contributorId),
    });
    return serialized ? [serialized] : [];
  });
}

export async function listConfigs(opts: {
  domain?: string;
  page: number;
  pageSize: number;
  yolo: boolean;
}): Promise<{ configs: WebMcpConfig[]; total: number }> {
  const where = opts.domain ? eq(configs.domain, opts.domain) : undefined;
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(configs)
      .where(where)
      .orderBy(desc(configs.updatedAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ value: count() }).from(configs).where(where),
  ]);
  return { configs: await hydrateConfigs(rows, opts.yolo), total: totals[0]?.value ?? 0 };
}

export async function getConfigById(id: string, yolo: boolean): Promise<WebMcpConfig | null> {
  const rows = await db.select().from(configs).where(eq(configs.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const hydrated = await hydrateConfigs([row], yolo);
  return hydrated[0] ?? null;
}
