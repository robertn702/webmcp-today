import { z } from "zod";
import { selectorSchema } from "./fields.js";

// Multi-step execution actions, ported from Joakim Selemyr's web-mcp-hub (MIT).
// Deliberate change: NO `evaluate` step — arbitrary code execution in the
// user's logged-in page is out of the format, by design.

export interface ConditionStep {
  action: "condition";
  selector: string;
  state: "visible" | "exists" | "hidden";
  then: ActionStep[];
  else?: ActionStep[];
}

export type ActionStep =
  | { action: "navigate"; url: string }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "select"; selector: string; value: string }
  | {
      action: "wait";
      selector: string;
      state?: "visible" | "exists" | "hidden";
      timeout?: number;
    }
  | {
      action: "extract";
      selector: string;
      extract: "text" | "html" | "list" | "table" | "attribute";
      attribute?: string;
    }
  | { action: "scroll"; selector: string }
  | ConditionStep;

const conditionStepSchema = z.object({
  action: z.literal("condition"),
  selector: selectorSchema,
  state: z.enum(["visible", "exists", "hidden"]),
  get then(): z.ZodType<ActionStep[]> {
    return z.array(actionStepSchema).max(20);
  },
  get else(): z.ZodType<ActionStep[] | undefined> {
    return z.array(actionStepSchema).max(20).optional();
  },
});

export const actionStepSchema: z.ZodType<ActionStep> = z.discriminatedUnion("action", [
  z.object({ action: z.literal("navigate"), url: z.string().min(1).max(2048) }),
  z.object({ action: z.literal("click"), selector: selectorSchema }),
  z.object({ action: z.literal("fill"), selector: selectorSchema, value: z.string().max(10000) }),
  z.object({ action: z.literal("select"), selector: selectorSchema, value: z.string().max(500) }),
  z.object({
    action: z.literal("wait"),
    selector: selectorSchema,
    state: z.enum(["visible", "exists", "hidden"]).optional(),
    timeout: z.number().int().min(0).max(30000).optional(),
  }),
  z.object({
    action: z.literal("extract"),
    selector: selectorSchema,
    extract: z.enum(["text", "html", "list", "table", "attribute"]),
    attribute: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("scroll"), selector: selectorSchema }),
  conditionStepSchema,
]);
