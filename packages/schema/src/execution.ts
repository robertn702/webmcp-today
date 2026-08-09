import { z } from "zod";

// Execution descriptor — v1 supports exactly one mode:
//   - "api": binds the tool to an api.endpoints entry by name.
// Reference integrity + {{param}} checks are package-level (they need the
// sibling `api` block) — see collectApiIssues in api.ts.
// `mode` stays an explicit literal (rather than dropping the field) so a
// future execution mode can turn this back into a discriminated union
// without migrating published package data.

export const apiExecutionSchema = z.strictObject({
  mode: z.literal("api"),
  endpoint: z.string().min(1).max(64),
});

export const executionDescriptorSchema = apiExecutionSchema;

export type ApiExecution = z.infer<typeof apiExecutionSchema>;
export type ExecutionDescriptor = z.infer<typeof executionDescriptorSchema>;
