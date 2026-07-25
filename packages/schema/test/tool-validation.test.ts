import { describe, expect, it } from "vitest";
import { actionStepSchema, toolDescriptorSchema } from "../src/index.js";

const inputSchema = {
  type: "object",
  properties: { query: { type: "string", description: "Search query" } },
  required: ["query"],
};

describe("toolDescriptorSchema", () => {
  it("rejects execution fields that do not map to inputSchema properties", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: {
        mode: "dom",
        selector: "form",
        autosubmit: true,
        fields: [{ type: "text", selector: "#q", name: "nope", description: "Bad field" }],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects {{template}} vars that do not map to inputSchema properties", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: {
        mode: "dom",
        selector: "form",
        autosubmit: false,
        steps: [{ action: "fill", selector: "#q", value: "{{missing}}" }],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects {{template}} vars nested inside a condition step's then branch", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: {
        mode: "dom",
        selector: "form",
        autosubmit: false,
        steps: [
          {
            action: "condition",
            selector: "#modal",
            state: "visible",
            then: [{ action: "fill", selector: "#q", value: "{{missing}}" }],
          },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects {{template}} vars nested inside a condition step's else branch", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: {
        mode: "dom",
        selector: "form",
        autosubmit: false,
        steps: [
          {
            action: "condition",
            selector: "#modal",
            state: "hidden",
            then: [{ action: "click", selector: "#ok" }],
            else: [
              {
                action: "condition",
                selector: "#inner",
                state: "visible",
                then: [{ action: "fill", selector: "#q", value: "{{typo}}" }],
              },
            ],
          },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid multi-step tool with nested condition steps", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: {
        mode: "dom",
        selector: "body",
        autosubmit: false,
        steps: [
          { action: "fill", selector: "#q", value: "{{query}}" },
          {
            action: "condition",
            selector: "#cookie-banner",
            state: "visible",
            then: [{ action: "click", selector: "#accept" }],
          },
          { action: "extract", selector: ".results", extract: "list" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("actionStepSchema", () => {
  it("has no evaluate step (by design)", () => {
    const result = actionStepSchema.safeParse({ action: "evaluate", value: "alert(1)" });
    expect(result.success).toBe(false);
  });
});
