import { z } from "zod";
import { selectorSchema, toolFieldSchema } from "./fields.js";
import { actionStepSchema } from "./steps.js";

// Execution descriptor — either simple mode (fields/autosubmit/result*) or
// multi-step mode (steps[]).

export const executionDescriptorSchema = z.object({
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

export type ExecutionDescriptor = z.infer<typeof executionDescriptorSchema>;
