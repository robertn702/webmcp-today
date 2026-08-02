import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const docsDirectory = resolve(testDirectory, "../content/docs");
const routesDirectory = resolve(testDirectory, "../app/docs");

describe("documentation LLM routes", () => {
  it("lists every public document with explicit Markdown URLs", async () => {
    const route = await readFile(resolve(routesDirectory, "llms.txt/route.ts"), "utf8");

    expect(route).toContain("https://webmcp.today${page.url}.md");
    expect(route).toContain("text/plain; charset=utf-8");
  });

  it("keeps MDX content and its Markdown route aligned", async () => {
    const quickstart = await readFile(resolve(docsDirectory, "quickstart.mdx"), "utf8");
    const route = await readFile(resolve(routesDirectory, "markdown/route.ts"), "utf8");

    expect(quickstart).toContain("Make your first live tool call");
    expect(quickstart).toContain("list_connected_webmcp_tabs");
    expect(route).toContain("getDocumentationMarkdown");
    expect(route).toContain("text/markdown; charset=utf-8");
  });

  it("provides a full-context route over processed Markdown", async () => {
    const route = await readFile(resolve(routesDirectory, "llms-full.txt/route.ts"), "utf8");
    const source = await readFile(resolve(testDirectory, "../lib/source.ts"), "utf8");

    expect(route).toContain("getDocumentationMarkdown");
    expect(source).toContain("EXAMPLE_PACKAGE_JSON");
    expect(source).toContain("<WebMcpReadiness />");
  });
});
