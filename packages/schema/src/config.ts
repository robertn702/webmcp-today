import { z } from "zod";
import { toolDescriptorSchema } from "./tool.js";

// Config format v1 — based on Joakim Selemyr's web-mcp-hub (MIT), extended
// with minEngine (format evolution) and room for health/verification metadata.

/** Version of the config format itself; configs may declare `minEngine`. */
export const SCHEMA_VERSION = "1.0.0";

export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver (x.y.z)");

export const domainSchema = z
  .string()
  .min(1)
  .max(253)
  .transform((d) => d.toLowerCase().replace(/^www\./, ""));

/** Strip protocol and trailing slashes so patterns are always "domain/path". */
function normalizeUrlPattern(val: string): string {
  return val.replace(/^https?:\/\//, "").replace(/\/+$/, "") || val;
}

export const urlPatternSchema = z.string().min(1).max(2048).transform(normalizeUrlPattern);

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

/** What contributors submit (contributor identity comes from auth, not the body). */
export const createConfigSchema = z.object({
  domain: domainSchema,
  urlPattern: urlPatternSchema,
  pageType: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  tools: toolsArraySchema,
  tags: z.array(z.string().max(50)).max(10).optional(),
  minEngine: semverSchema.optional(),
});

export const updateConfigSchema = createConfigSchema.partial();

export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
