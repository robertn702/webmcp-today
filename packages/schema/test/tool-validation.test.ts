import { describe, expect, it } from "vitest";
import { toolDescriptorSchema } from "../src/index.js";

const inputSchema = {
  type: "object",
  properties: { query: { type: "string", description: "Search query" } },
  required: ["query"],
  additionalProperties: false,
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

  it("rejects a tool with execution omitted entirely", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a tool with a destructiveHint annotation", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "delete",
      description: "Delete",
      inputSchema,
      annotations: { destructiveHint: true, readOnlyHint: false },
      execution: { mode: "api", endpoint: "delete" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a readOnlyHint + destructiveHint combination", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      annotations: { destructiveHint: true, readOnlyHint: true },
      execution: { mode: "api", endpoint: "search" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key on the annotations object", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "search",
      description: "Search",
      inputSchema,
      annotations: { readOnlyHint: true, extra: true },
      execution: { mode: "api", endpoint: "search" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean destructiveHint annotation", () => {
    const result = toolDescriptorSchema.safeParse({
      name: "delete",
      description: "Delete",
      inputSchema,
      annotations: { destructiveHint: "yes" },
      execution: { mode: "api", endpoint: "delete" },
    });
    expect(result.success).toBe(false);
  });
});
