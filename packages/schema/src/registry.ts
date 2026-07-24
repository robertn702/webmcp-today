import { z } from "zod";
import { createConfigObjectSchema } from "./config.js";

// Shapes served by the registry API (superset of the submission format).

/**
 * A definition + one of its versions, as served by the registry. `id` is the
 * definition id (stable identity); `versionId` + `version` identify which
 * version this document is. Install counts are derived, not denormalized.
 */
export const webMcpConfigSchema = createConfigObjectSchema.extend({
  id: z.string(),
  versionId: z.string(),
  version: z.number().int().min(1),
  contributor: z.string(),
  installCount: z.number().int().min(0).optional(),
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
  totalInstalls: z.number().int().min(0),
  topDomains: z.array(z.object({ domain: z.string(), count: z.number().int().min(0) })),
});

export type WebMcpConfig = z.infer<typeof webMcpConfigSchema>;
export type ConfigListResponse = z.infer<typeof configListResponseSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
