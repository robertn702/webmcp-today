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
    additionalProperties: false,
  },
  execution: { mode: "api", endpoint: "search" },
};

const baseConfig = {
  version: 1,
  domain: "Acme.com",
  urlPatterns: ["*://acme.com/search*"],
  title: "Example search",
  description: "Search tools for acme.com",
  tools: [baseTool],
  api: {
    baseUrl: "https://acme.com",
    endpoints: {
      search: { method: "GET", path: "/search", query: { query: "{{query}}" } },
    },
  },
  minEngine: 1,
};

describe("createPackageSchema", () => {
  it("normalizes domain (lowercase, strips www.)", () => {
    const parsed = createPackageSchema.parse({ ...baseConfig, domain: "WWW.Acme.com" });
    expect(parsed.domain).toBe("acme.com");
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
        api: baseConfig.api,
        minEngine: baseConfig.minEngine,
      }).success,
    ).toBe(true);
    expect(
      publishVersionSchema.safeParse({
        urlPatterns: baseConfig.urlPatterns,
        tools: baseConfig.tools,
        api: baseConfig.api,
        minEngine: baseConfig.minEngine,
      }).success,
    ).toBe(false);
    // Meta edits never create versions, so a declared version is not a recognized key.
    expect(updatePackageMetaSchema.safeParse({ title: "New title", version: 7 }).success).toBe(
      false,
    );
    const meta = updatePackageMetaSchema.parse({ title: "New title" });
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

  it.each([
    "service.localhost",
    "service.test",
    "service.example",
    "service.onion",
    "service.onion.",
    "foo.home.arpa",
    "resolver.arpa",
    "resolver.arpa.",
    "ipv4only.arpa",
    "service.in-addr.arpa",
    "service.ip6.arpa",
    "jira.internal",
    "example.com",
    "api.example.net",
    "www.example.org",
  ])("rejects special-use and unrecognized local domain %s", (domain) => {
    expect(
      createPackageSchema.safeParse({
        ...baseConfig,
        domain,
        urlPatterns: [`*://${domain}/*`],
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
        domain: "acme.com",
        urlPatterns: ["*://acme.com/*", "*://api.acme.com/*", "*://*.acme.com/*"],
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

  it("requires minEngine as a positive integer and rejects non-integer/non-positive", () => {
    const noMinEngine: Record<string, unknown> = { ...baseConfig };
    delete noMinEngine.minEngine;
    expect(createPackageSchema.safeParse(noMinEngine).success).toBe(false);
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
      api: { ...baseConfig.api, baseUrl: "https://reddit.com" },
    });
    expect(result.success).toBe(true);
  });

  it("enforces the parent package domain for version publication", () => {
    const schema = publishVersionSchemaForDomain("reddit.com");
    const version = {
      version: 2,
      urlPatterns: ["*://*.reddit.com/*"],
      tools: [baseTool],
      minEngine: 1,
      api: {
        baseUrl: "https://www.reddit.com",
        endpoints: { search: { method: "GET", path: "/search", query: { query: "{{query}}" } } },
      },
    };
    expect(schema.safeParse(version).success).toBe(true);
    expect(schema.safeParse({ ...version, urlPatterns: ["*://*/*"] }).success).toBe(false);
    expect(
      schema.safeParse({ ...version, urlPatterns: ["*://news.ycombinator.com/*"] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...version,
        api: { ...version.api, baseUrl: "https://evil.example.com" },
      }).success,
    ).toBe(false);
  });

  it("checks coverage against the normalized domain (www-stripped)", () => {
    const result = createPackageSchema.safeParse({
      ...baseConfig,
      domain: "www.acme.com",
      urlPatterns: ["*://acme.com/*"],
    });
    expect(result.success).toBe(true);
  });
});
