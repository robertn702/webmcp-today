import { describe, expect, it } from "vitest";
import { toolDescriptorSchema } from "../src/index.js";

const inputSchema = {
  type: "object",
  properties: { query: { type: "string", description: "Search query" } },
  required: ["query"],
};

describe("toolDescriptorSchema", () => {
  it("accepts a valid api-execution tool", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: { mode: "api", endpoint: "search" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown execution mode", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: { mode: "dom", selector: "form", autosubmit: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an api execution without an endpoint", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: { mode: "api" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tool with no execution mode (bare execution object)", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      execution: { endpoint: "search" },
    });
    expect(result.success).toBe(false);
  });
});
