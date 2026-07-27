import { z } from "zod";
import { createPackageObjectSchema } from "./package.js";

// Shapes served by the registry API (superset of the submission format).

/**
 * A package + one of its versions, as served by the registry. `id` is the
 * package id (stable identity); `versionId` + `version` identify which
 * version this document is. Install counts are derived, not denormalized.
 */
export const webMcpPackageSchema = createPackageObjectSchema.extend({
  id: z.string(),
  versionId: z.string(),
  version: z.number().int().min(1),
  /**
   * Content identifier for this version's `api` block (see apiContentHash);
   * absent exactly when there is no `api`. Lets a client recognise a surface
   * it already holds — the same block recurs across a package's versions and
   * across rival packages targeting the same site.
   */
  apiContentHash: z.string().optional(),
  contributor: z.string(),
  installCount: z.number().int().min(0).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const packageListResponseSchema = z.object({
  packages: z.array(webMcpPackageSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const statsResponseSchema = z.object({
  totalPackages: z.number().int().min(0),
  totalInstalls: z.number().int().min(0),
  topDomains: z.array(z.object({ domain: z.string(), count: z.number().int().min(0) })),
});

/**
 * One entry in the revocation feed. Once installed package bodies live on the
 * client's disk the registry is off the read path, so this feed is the only
 * lever it keeps after install: a package pulled for malware otherwise runs
 * forever on every machine that has it.
 *
 * `id` is monotonic and doubles as the client's poll cursor — hence a number
 * rather than the uuid the registry's other ids use.
 */
export const revocationEntrySchema = z.object({
  id: z.number().int().positive(),
  packageId: z.string(),
  /** Null revokes the whole package; otherwise only this one version. */
  versionId: z.string().nullable(),
  reason: z.string(),
  revokedAt: z.iso.datetime(),
});

/**
 * `GET /api/revocations?since=<cursor>`. `cursor` is what the client sends next
 * time, and is echoed back unchanged when there is nothing new.
 */
export const revocationsResponseSchema = z.object({
  cursor: z.number().int(),
  entries: z.array(revocationEntrySchema),
});

export type WebMcpPackage = z.infer<typeof webMcpPackageSchema>;
export type PackageListResponse = z.infer<typeof packageListResponseSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type RevocationEntry = z.infer<typeof revocationEntrySchema>;
export type RevocationsResponse = z.infer<typeof revocationsResponseSchema>;
