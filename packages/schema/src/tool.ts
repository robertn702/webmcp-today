import { z } from "zod";
import { TOOL_DESCRIPTION_MAX, TOOL_NAME_MAX } from "./budgets.js";
import { executionDescriptorSchema } from "./execution.js";
import { inputSchemaSchema } from "./input-schema.js";

// Tool descriptor — one WebMCP tool: metadata + optional declarative execution.

export const toolAnnotationsSchema = z.looseObject({
  readOnlyHint: z.boolean().optional(),
  untrustedContentHint: z.boolean().optional(),
});

export const toolDescriptorSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(TOOL_NAME_MAX)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "must start with a letter; letters/digits/_/- only"),
  description: z.string().min(1).max(TOOL_DESCRIPTION_MAX),
  inputSchema: inputSchemaSchema,
  annotations: toolAnnotationsSchema.optional(),
  // How the tool executes: v1 is "api" only. API-endpoint reference +
  // placeholder checks are package-level (they need the sibling `api`
  // block) — see collectApiIssues in api.ts.
  execution: executionDescriptorSchema.optional(),
});

export type ToolAnnotations = z.infer<typeof toolAnnotationsSchema>;
export type ToolDescriptor = z.infer<typeof toolDescriptorSchema>;
