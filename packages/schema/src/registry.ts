import { z } from "zod";
import { createConfigSchema } from "./config.js";

// Shapes served by the registry API (superset of the submission format).

/** Registry-managed health metadata (room for canary CI; not built in v1). */
export const configHealthSchema = z.object({
  status: z.enum(["unknown", "passing", "failing"]),
  lastCheckedAt: z.iso.datetime().optional(),
});

/** Full config as served by the registry. */
export const webMcpConfigSchema = createConfigSchema.extend({
  id: z.string(),
  contributor: z.string(),
  version: z.number().int().min(1),
  verified: z.boolean(),
  /** Tools with a current verification snapshot (subset of tools[].name). */
  verifiedToolNames: z.array(z.string()).optional(),
  /** Total tools on the row (may exceed tools.length under verified-only filtering). */
  totalToolCount: z.number().int().min(0).optional(),
  score: z.number().int().optional(),
  health: configHealthSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const configListResponseSchema = z.object({
  configs: z.array(webMcpConfigSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const statsResponseSchema = z.object({
  totalConfigs: z.number().int().min(0),
  totalTools: z.number().int().min(0),
  topDomains: z.array(z.object({ domain: z.string(), count: z.number().int().min(0) })),
});

export type ConfigHealth = z.infer<typeof configHealthSchema>;
export type WebMcpConfig = z.infer<typeof webMcpConfigSchema>;
export type ConfigListResponse = z.infer<typeof configListResponseSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
