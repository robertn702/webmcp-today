import { describe, expect, it } from "vitest";
import {
  createPackageSchema,
  publishVersionSchema,
  publishVersionSchemaForDomain,
  updatePackageMetaSchema,
} from "../src/index.js";

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
  version: 1,
  domain: "Example.com",
  urlPatterns: ["*://example.com/search*"],
  title: "Example search",
  description: "Search tools for example.com",
  tools: [baseTool],
};

describe("createPackageSchema", () => {
  it("normalizes domain (lowercase, strips www.)", () => {
    const parsed = createPackageSchema.parse({ ...baseConfig, domain: "WWW.Example.com" });
    expect(parsed.domain).toBe("example.com");
  });

  it("requires an author-declared positive-integer version", () => {
    const noVersion: Record<string, unknown> = { ...baseConfig };
    delete noVersion.version;
    expect(createPackageSchema.safeParse(noVersion).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...baseConfig, version: 0 }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...baseConfig, version: 1.5 }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...baseConfig, version: "1.0.0" }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...baseConfig, version: 2 }).success).toBe(true);
  });

  it("carries version into publishVersionSchema but not updatePackageMetaSchema", () => {
    expect(
      publishVersionSchema.safeParse({
        version: 2,
        urlPatterns: baseConfig.urlPatterns,
        tools: baseConfig.tools,
      }).success,
    ).toBe(true);
    expect(
      publishVersionSchema.safeParse({
        urlPatterns: baseConfig.urlPatterns,
        tools: baseConfig.tools,
      }).success,
    ).toBe(false);
    // Meta edits never create versions, so a declared version is stripped, not kept.
    const meta = updatePackageMetaSchema.parse({ title: "New title", version: 7 });
    expect("version" in meta).toBe(false);
  });

  it("rejects urlPatterns that aren't valid match patterns", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      urlPatterns: ["example.com/search"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a global wildcard pattern", () => {
    expect(createPackageSchema.safeParse({ ...baseConfig, urlPatterns: ["*://*/*"] }).success).toBe(
      false,
    );
  });

  it("rejects public suffix domains and wildcard hosts", () => {
    expect(
      createPackageSchema.safeParse({
        ...baseConfig,
        domain: "com",
        urlPatterns: ["*://*.com/*"],
      }).success,
    ).toBe(false);
    expect(
      createPackageSchema.safeParse({
        ...baseConfig,
        domain: "example.co.uk",
        urlPatterns: ["*://*.co.uk/*"],
      }).success,
    ).toBe(false);
  });

  it("rejects patterns outside the visible package domain", () => {
    expect(
      createPackageSchema.safeParse({
        ...baseConfig,
        domain: "reddit.com",
        urlPatterns: ["*://news.ycombinator.com/*"],
      }).success,
    ).toBe(false);
  });

  it("accepts apex and subdomain patterns within the visible package domain", () => {
    expect(
      createPackageSchema.safeParse({
        ...baseConfig,
        domain: "example.com",
        urlPatterns: ["*://example.com/*", "*://api.example.com/*", "*://*.example.com/*"],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty urlPatterns array", () => {
    const result = createPackageSchema.safeParse({ ...baseConfig, urlPatterns: [] });
    expect(result.success).toBe(false);
  });

  it("accepts an optional changelog", () => {
    expect(
      createPackageSchema.safeParse({ ...baseConfig, changelog: "Fixed a rotted selector" })
        .success,
    ).toBe(true);
  });

  it("rejects duplicate tool names", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      tools: [baseTool, { ...baseTool, description: "Another" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty tools arrays", () => {
    const result = createPackageSchema.safeParse({ ...baseConfig, tools: [] });
    expect(result.success).toBe(false);
  });

  it("accepts optional minEngine integer level and rejects non-integer/non-positive", () => {
    expect(createPackageSchema.safeParse({ ...baseConfig, minEngine: 1 }).success).toBe(true);
    expect(createPackageSchema.safeParse({ ...baseConfig, minEngine: 0 }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...baseConfig, minEngine: 1.5 }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...baseConfig, minEngine: "1.0.0" }).success).toBe(
      false,
    );
  });

  it("rejects tool names over the 30-char budget", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      tools: [{ ...baseTool, name: "a".repeat(31) }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a domain no urlPattern host covers (unreachable by lookup)", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      domain: "foo.com",
      urlPatterns: ["*://bar.com/*"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "domain")).toBe(true);
    }
  });

  it("accepts a domain covered by a *.host wildcard (apex included)", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      domain: "reddit.com",
      urlPatterns: ["*://*.reddit.com/*"],
    });
    expect(result.success).toBe(true);
  });

  it("enforces the parent package domain for version publication", () => {
    const schema = publishVersionSchemaForDomain("reddit.com");
    const version = {
      version: 2,
      urlPatterns: ["*://*.reddit.com/*"],
      tools: [baseTool],
      api: { baseUrl: "https://www.reddit.com", endpoints: {} },
    };
    expect(schema.safeParse(version).success).toBe(true);
    expect(schema.safeParse({ ...version, urlPatterns: ["*://*/*"] }).success).toBe(false);
    expect(
      schema.safeParse({ ...version, urlPatterns: ["*://news.ycombinator.com/*"] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...version, api: { baseUrl: "https://evil.example.com", endpoints: {} } })
        .success,
    ).toBe(false);
  });

  it("checks coverage against the normalized domain (www-stripped)", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      domain: "www.example.com",
      urlPatterns: ["*://example.com/*"],
    });
    expect(result.success).toBe(true);
  });
});
