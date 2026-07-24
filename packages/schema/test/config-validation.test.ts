import { describe, expect, it } from "vitest";
import { createConfigSchema } from "../src/index.js";

const baseTool = {
  name: "search",
  description: "Search the site",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "Search query" } },
    required: ["query"],
  },
};

const baseConfig = {
  domain: "Example.com",
  urlPatterns: ["*://example.com/search*"],
  title: "Example search",
  description: "Search tools for example.com",
  tools: [baseTool],
};

describe("createConfigSchema", () => {
  it("normalizes domain (lowercase, strips www.)", () => {
    const parsed = createConfigSchema.parse({ ...baseConfig, domain: "WWW.Example.com" });
    expect(parsed.domain).toBe("example.com");
  });

  it("rejects urlPatterns that aren't valid match patterns", () => {
    const result = createConfigSchema.safeParse({
      ...baseConfig,
      urlPatterns: ["example.com/search"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty urlPatterns array", () => {
    const result = createConfigSchema.safeParse({ ...baseConfig, urlPatterns: [] });
    expect(result.success).toBe(false);
  });

  it("accepts an optional changelog", () => {
    expect(
      createConfigSchema.safeParse({ ...baseConfig, changelog: "Fixed a rotted selector" }).success,
    ).toBe(true);
  });

  it("rejects duplicate tool names", () => {
    const result = createConfigSchema.safeParse({
      ...baseConfig,
      tools: [baseTool, { ...baseTool, description: "Another" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty tools arrays", () => {
    const result = createConfigSchema.safeParse({ ...baseConfig, tools: [] });
    expect(result.success).toBe(false);
  });

  it("accepts optional minEngine integer level and rejects non-integer/non-positive", () => {
    expect(createConfigSchema.safeParse({ ...baseConfig, minEngine: 1 }).success).toBe(true);
    expect(createConfigSchema.safeParse({ ...baseConfig, minEngine: 0 }).success).toBe(false);
    expect(createConfigSchema.safeParse({ ...baseConfig, minEngine: 1.5 }).success).toBe(false);
    expect(createConfigSchema.safeParse({ ...baseConfig, minEngine: "1.0.0" }).success).toBe(false);
  });

  it("rejects tool names over the 30-char budget", () => {
    const result = createConfigSchema.safeParse({
      ...baseConfig,
      tools: [{ ...baseTool, name: "a".repeat(31) }],
    });
    expect(result.success).toBe(false);
  });
});
