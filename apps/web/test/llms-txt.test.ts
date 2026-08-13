import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nextConfig } from "../next.config";

const llmsPath = resolve(import.meta.dirname, "../public/llms.txt");

describe("llms.txt", () => {
  const content = readFileSync(llmsPath, "utf8");

  it("has the curated llms.txt structure and canonical links", () => {
    expect(content.match(/^# /gm)).toHaveLength(1);
    expect(content.startsWith("# WebMCP Today\n\n> ")).toBe(true);
    expect(content).toContain("## Get Started");
    expect(content).toContain("## Build and Publish");
    expect(content).toContain("## Project");
    expect(content).toContain("## Optional");
    expect(content).toContain("https://webmcp.today/docs");
    expect(content).toContain("https://webmcp.today/docs/quickstart");
    expect(content).toContain("https://webmcp.today/docs/package-format");
    expect(content).toContain("https://webmcp.today/extension");
    expect(content).toContain("https://webmcp.today/submit");
    expect(content).toContain("https://webmcp.today/packages");
    expect(content).toContain("https://webmcp.today/terms");
    expect(content).toContain("https://webmcp.today/privacy");
    expect(content).toContain("https://github.com/robertn702/webmcp-today");
    expect(content).toContain("package versions the user approves");
    expect(content).not.toMatch(/https:\/\/webmcp\.today\/packages\/[^)\s]+/);
    expect(content).not.toMatch(/registry-approved packages/i);
    expect(content).not.toMatch(/npm|package_versions|listServablePackages|sitemap/i);
  });

  it("advertises the catch-all describedby header", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    if (nextConfig.headers === undefined) return;

    await expect(nextConfig.headers()).resolves.toContainEqual({
      source: "/((?!api/packages(?:/[^/]+/versions)?/?$).*)",
      headers: [{ key: "Link", value: '</llms.txt>; rel="describedby"' }],
    });
  });
});
