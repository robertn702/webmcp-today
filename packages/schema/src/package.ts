import { z } from "zod";
import { apiBlockSchema, collectApiIssues } from "./api.js";
import { toolDescriptorSchema } from "./tool.js";
import { domainCoveredByPatterns, parseUrlPattern } from "./url-matching.js";

// Package format v1 — based on Joakim Selemyr's web-mcp-hub (MIT), extended
// with minEngine (format evolution) and room for health/verification metadata.

/**
 * Capability floor, like an Android API level — an implementation-neutral
 * integer compared with plain `>=` against `ENGINE_VERSION` (see budgets.ts).
 * Not semver: the format has no patch releases, so semver's extra dimensions
 * are meaningless here. Lives on `package_versions` (see publishVersionSchema),
 * not package metadata, since engine requirements are a property of a
 * version's content (e.g. a version using the `api` block needs a higher level
 * than a DOM-only version) — a user pinned to an older version must not be
 * told their engine is too old because of a newer version's requirements.
 */
export const engineLevelSchema = z.number().int().positive();

export const domainSchema = z
  .string()
  .min(1)
  .max(253)
  .transform((d) => d.toLowerCase().replace(/^www\./, ""));

/** Chrome extension `@match`-style pattern, e.g. "*://*.wikipedia.org/wiki/*". */
export const urlPatternSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((v) => parseUrlPattern(v) !== null, {
    message: 'must be a match pattern like "*://*.example.com/*" (scheme://host/path)',
  });

const toolsArraySchema = z
  .array(toolDescriptorSchema)
  .min(1)
  .max(30)
  .superRefine((tools, ctx) => {
    const seen = new Set<string>();
    for (const [i, tool] of tools.entries()) {
      if (seen.has(tool.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate tool name "${tool.name}"`,
          path: [i, "name"],
        });
      }
      seen.add(tool.name);
    }
  });

/**
 * Base object shape. Kept as a plain ZodObject (no refinement) so the derived
 * schemas below can still `.pick`/`.omit`/`.partial`/`.extend` it — the same
 * split tool.ts uses (object schema vs refined schema). `createPackageSchema`
 * wraps it with the api cross-validation.
 */
export const createPackageObjectSchema = z.object({
  domain: domainSchema,
  urlPatterns: z.array(urlPatternSchema).min(1).max(20),
  pageType: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  tools: toolsArraySchema,
  /** Tier-1 API execution surface; tools bind to it via their `endpoint`. */
  api: apiBlockSchema.optional(),
  minEngine: engineLevelSchema.optional(),
  /** What changed in this version; shown to installed users deciding whether to update. */
  changelog: z.string().max(2000).optional(),
});

/** What contributors submit (contributor identity comes from auth, not the body). */
export const createPackageSchema = createPackageObjectSchema.superRefine((pkg, ctx) => {
  for (const issue of collectApiIssues(pkg)) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
  // The lookup key `domain` must be reachable through the urlPatterns, or the
  // package publishes but no page can ever serve it (see domainCoveredByPatterns).
  if (!domainCoveredByPatterns(pkg.domain, pkg.urlPatterns)) {
    ctx.addIssue({
      code: "custom",
      message: `domain "${pkg.domain}" is not covered by any urlPatterns host, so it would be unreachable by lookup. Add a urlPattern whose host covers it (e.g. "*://${pkg.domain}/*").`,
      path: ["domain"],
    });
  }
});

/** Metadata-only edits (packages row) — excludes versioned fields. */
export const updatePackageMetaSchema = createPackageObjectSchema
  .omit({ urlPatterns: true, tools: true, api: true, changelog: true, minEngine: true })
  .partial();

/** A new version of an existing package (package_versions row) — append-only.
 * `api` travels with tools (it is execution data), so it is version-scoped too.
 * `minEngine` is also version-scoped: it describes what a specific version's
 * content requires, not the package as a whole. */
export const publishVersionSchema = createPackageObjectSchema
  .pick({ urlPatterns: true, tools: true, api: true, changelog: true, minEngine: true })
  .superRefine((pkg, ctx) => {
    for (const issue of collectApiIssues(pkg)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageMetaInput = z.infer<typeof updatePackageMetaSchema>;
export type PublishVersionInput = z.infer<typeof publishVersionSchema>;
