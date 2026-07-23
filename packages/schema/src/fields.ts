import { z } from "zod";
import { PARAM_DESCRIPTION_MAX } from "./budgets.js";

// Tool fields (simple-mode execution) — discriminated union on `type`.
// Format ported from Joakim Selemyr's web-mcp-hub (MIT).

export const selectorSchema = z.string().min(1).max(500);

const fieldBase = {
  selector: selectorSchema,
  // Field names become inputSchema properties and {{param}} template vars.
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "must be a valid identifier"),
  description: z.string().min(1).max(PARAM_DESCRIPTION_MAX),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
};

const selectOptionSchema = z.object({
  value: z.string().max(100),
  label: z.string().max(200),
});

const radioOptionSchema = z.object({
  value: z.string().max(100),
  label: z.string().max(200),
  selector: selectorSchema,
});

export const toolFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...fieldBase, type: z.literal("text") }),
  z.object({ ...fieldBase, type: z.literal("number") }),
  z.object({ ...fieldBase, type: z.literal("textarea") }),
  z.object({
    ...fieldBase,
    type: z.literal("select"),
    options: z.array(selectOptionSchema).max(100).optional(),
    dynamicOptions: z.boolean().optional(),
  }),
  z.object({ ...fieldBase, type: z.literal("checkbox") }),
  z.object({
    ...fieldBase,
    type: z.literal("radio"),
    options: z.array(radioOptionSchema).min(1).max(50),
  }),
  z.object({ ...fieldBase, type: z.literal("date") }),
  z.object({ ...fieldBase, type: z.literal("hidden") }),
]);

export type ToolField = z.infer<typeof toolFieldSchema>;
export type SelectOption = z.infer<typeof selectOptionSchema>;
export type RadioOption = z.infer<typeof radioOptionSchema>;
