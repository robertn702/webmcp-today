import { z } from "zod";
import { TOOL_DESCRIPTION_MAX, TOOL_NAME_MAX } from "./budgets.js";
import { executionDescriptorSchema } from "./execution.js";
import { inputSchemaSchema } from "./input-schema.js";

// Tool descriptor — one WebMCP tool: metadata + optional declarative execution.

export const toolAnnotationsSchema = z.looseObject({
  readOnlyHint: z.boolean().optional(),
  untrustedContentHint: z.boolean().optional(),
});

export const toolDescriptorObjectSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(TOOL_NAME_MAX)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "must start with a letter; letters/digits/_/- only"),
  description: z.string().min(1).max(TOOL_DESCRIPTION_MAX),
  inputSchema: inputSchemaSchema,
  annotations: toolAnnotationsSchema.optional(),
  execution: executionDescriptorSchema.optional(),
});

const TEMPLATE_RE = /\{\{(\w+)\}\}/g;

/** Cross-validates execution against inputSchema (field names, {{param}} templates). */
export const toolDescriptorSchema = toolDescriptorObjectSchema.superRefine((tool, ctx) => {
  if (!tool.execution) return;
  const props = Object.keys(tool.inputSchema.properties);

  const fields = tool.execution.fields ?? [];
  for (const [i, field] of fields.entries()) {
    if (!props.includes(field.name)) {
      ctx.addIssue({
        code: "custom",
        message: `Execution field "${field.name}" has no matching inputSchema property. Available: ${props.join(", ") || "(none)"}`,
        path: ["execution", "fields", i, "name"],
      });
    }
  }

  const checkTemplates = (value: string, path: (string | number)[]): void => {
    for (const m of value.matchAll(TEMPLATE_RE)) {
      const name = m[1];
      if (name !== undefined && !props.includes(name)) {
        ctx.addIssue({
          code: "custom",
          message: `Template variable "{{${name}}}" has no matching inputSchema property. Available: ${props.join(", ") || "(none)"}`,
          path,
        });
      }
    }
  };

  const steps = tool.execution.steps ?? [];
  for (const [i, step] of steps.entries()) {
    const base = ["execution", "steps", i];
    if ("url" in step) checkTemplates(step.url, [...base, "url"]);
    if ("value" in step) checkTemplates(step.value, [...base, "value"]);
    if ("selector" in step) checkTemplates(step.selector, [...base, "selector"]);
  }
});

export type ToolAnnotations = z.infer<typeof toolAnnotationsSchema>;
export type ToolDescriptor = z.infer<typeof toolDescriptorSchema>;
