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
  urlPattern: "https://example.com/search/",
  title: "Example search",
  description: "Search tools for example.com",
  tools: [baseTool],
};

describe("createConfigSchema", () => {
  it("normalizes domain (lowercase, strips www.) and urlPattern (protocol, trailing slash)", () => {
    const parsed = createConfigSchema.parse({ ...baseConfig, domain: "WWW.Example.com" });
    expect(parsed.domain).toBe("example.com");
    expect(parsed.urlPattern).toBe("example.com/search");
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

  it("accepts optional minEngine semver and rejects garbage", () => {
    expect(createConfigSchema.safeParse({ ...baseConfig, minEngine: "1.0.0" }).success).toBe(true);
    expect(createConfigSchema.safeParse({ ...baseConfig, minEngine: "latest" }).success).toBe(
      false,
    );
  });

  it("rejects tool names over the 30-char budget", () => {
    const result = createConfigSchema.safeParse({
      ...baseConfig,
      tools: [{ ...baseTool, name: "a".repeat(31) }],
    });
    expect(result.success).toBe(false);
  });
});
