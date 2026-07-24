import { z } from "zod";
import { selectorSchema, toolFieldSchema } from "./fields.js";
import { actionStepSchema } from "./steps.js";

// Execution descriptor — a discriminated union keyed by `mode`.
//   - "dom": simple mode (fields/autosubmit/result*) or multi-step mode (steps[]).
//   - "api": binds the tool to an api.endpoints entry by name (tier-1 execution).
// Reference integrity + {{param}} checks for the "api" mode are config-level
// (they need the sibling `api` block) — see collectApiIssues in api.ts.

export const domExecutionSchema = z.object({
  mode: z.literal("dom"),
  selector: selectorSchema,
  fields: z.array(toolFieldSchema).max(20).optional(),
  autosubmit: z.boolean(),
  submitAction: z.enum(["click", "enter"]).optional(),
  submitSelector: z.string().max(500).optional(),
  resultSelector: z.string().max(500).optional(),
  resultExtract: z.enum(["text", "html", "attribute", "table", "list"]).optional(),
  resultAttribute: z.string().max(200).optional(),
  steps: z.array(actionStepSchema).max(50).optional(),
  resultDelay: z.number().int().min(0).max(30000).optional(),
  resultWaitSelector: z.string().max(500).optional(),
  resultRequired: z.boolean().optional(),
});

export const apiExecutionSchema = z.object({
  mode: z.literal("api"),
  endpoint: z.string().min(1).max(64),
});

export const executionDescriptorSchema = z.discriminatedUnion("mode", [
  domExecutionSchema,
  apiExecutionSchema,
]);

export type DomExecution = z.infer<typeof domExecutionSchema>;
export type ApiExecution = z.infer<typeof apiExecutionSchema>;
export type ExecutionDescriptor = z.infer<typeof executionDescriptorSchema>;
