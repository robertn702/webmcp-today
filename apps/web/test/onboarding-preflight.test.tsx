import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { curatedPackages } from "@webmcp-today/curated-packages";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { BridgePingResponse } from "@robertn702/webmcp-today-schema";

vi.mock("@/lib/extension-bridge", () => ({
  pingExtension: () => Promise.resolve({ status: "absent" }),
  resetExtensionBridgeProbe: () => undefined,
}));

import { WebMcpReadinessView } from "@/components/webmcp-readiness";
import {
  FIRST_TOOL_NAME,
  FIRST_TOOL_PROMPT,
  EXTENSION_RELEASE_URL,
  MCP_CONFIG,
  QUICKSTART_PROMPT,
  REDDIT_DEMO_URL,
  REDDIT_PACKAGE_DOMAIN,
  REDDIT_TOOL_COUNT,
} from "@/app/(registry)/docs/content";
import {
  browserGuidance,
  extensionCheckpoint,
  webMcpCapabilities,
} from "@/lib/onboarding-preflight";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const quickstartPath = resolve(testDirectory, "../app/(registry)/docs/quickstart/page.tsx");
const docsPath = resolve(testDirectory, "../app/(registry)/docs/page.tsx");
const landingPath = resolve(testDirectory, "../app/page.tsx");

const PING_OK: BridgePingResponse = {
  ok: true,
  protocol: 1,
  engine: 1,
  extensionVersion: "0.0.1",
  storageReadable: true,
};

function readinessView(
  registration: Parameters<typeof WebMcpReadinessView>[0]["registration"],
  consumer: Parameters<typeof WebMcpReadinessView>[0]["consumer"],
  extension: Parameters<typeof WebMcpReadinessView>[0]["extension"],
): string {
  return renderToStaticMarkup(
    <WebMcpReadinessView
      registration={registration}
      consumer={consumer}
      extension={extension}
      guidance={browserGuidance({ userAgent: "Mozilla/5.0 Chrome/149.0" })}
      onCheckAgain={() => undefined}
    />,
  );
}

describe("bridge quickstart", () => {
  it("feature-detects registration and consumer APIs without using browser identity", () => {
    const registerTool = () => Promise.resolve();
    const getTools = () => Promise.resolve([]);
    const executeTool = () => Promise.resolve(null);

    expect(
      webMcpCapabilities({ modelContext: { registerTool, getTools, executeTool } }, {}),
    ).toEqual({
      registration: true,
      consumer: true,
    });
    expect(
      webMcpCapabilities({}, { modelContext: { registerTool, getTools, executeTool } }),
    ).toEqual({
      registration: true,
      consumer: true,
    });
    expect(webMcpCapabilities({ modelContext: { registerTool } }, {})).toEqual({
      registration: true,
      consumer: false,
    });
    expect(
      webMcpCapabilities(
        { modelContext: { registerTool } },
        { modelContext: { getTools, executeTool } },
      ),
    ).toEqual({ registration: true, consumer: true });
    expect(webMcpCapabilities({}, {})).toEqual({ registration: false, consumer: false });
  });

  it("uses browser identity only for a copy-only settings path", () => {
    expect(browserGuidance({ userAgent: "Mozilla/5.0 Chrome/149.0" })).toMatchObject({
      family: "chrome",
      settingsPath: "chrome://flags/#enable-webmcp-testing",
    });
    expect(browserGuidance({ userAgent: "Mozilla/5.0 Brave/1.92" })).toMatchObject({
      family: "brave",
      settingsPath: "brave://flags/#enable-webmcp-testing",
    });
    expect(browserGuidance({ userAgent: "Mozilla/5.0 Firefox/140.0" })).toEqual({
      family: "other",
    });
    expect(browserGuidance({ userAgent: "Mozilla/5.0 Edg/149.0" })).toEqual({ family: "other" });
  });

  it("maps installed-extension probes to actionable readiness states", () => {
    expect(extensionCheckpoint({ status: "absent" })).toBe("absent");
    expect(extensionCheckpoint({ status: "invalid" })).toBe("absent");
    expect(
      extensionCheckpoint({ status: "ok", data: { ...PING_OK, storageReadable: false } }),
    ).toBe("unreadable");
    expect(extensionCheckpoint({ status: "ok", data: PING_OK })).toBe("ready");
  });

  it("renders copy-only runtime remediation and an explicit native-host limitation", () => {
    const unavailable = readinessView("unavailable", "waiting", "waiting");
    expect(unavailable).toContain("chrome://flags/#enable-webmcp-testing");
    expect(unavailable).toContain('aria-label="Copy chrome://flags/#enable-webmcp-testing"');
    expect(unavailable).not.toContain('href="chrome://flags/#enable-webmcp-testing"');

    const ready = readinessView("ready", "ready", "ready");
    expect(ready).toContain("The extension answered this site and its storage is readable.");
    expect(ready).toContain("The website cannot detect a native host or your MCP configuration.");
    expect(ready).toContain("list_connected_webmcp_tabs");
  });

  it("keeps the verified first call grounded in the seeded read-only Reddit tool", () => {
    const redditPackage = curatedPackages.find((pkg) => pkg.domain === REDDIT_PACKAGE_DOMAIN);
    expect(redditPackage).toBeDefined();
    if (redditPackage === undefined) return;

    expect(redditPackage.tools).toHaveLength(REDDIT_TOOL_COUNT);
    expect(redditPackage.tools.find((tool) => tool.name === FIRST_TOOL_NAME)).toMatchObject({
      annotations: { readOnlyHint: true },
    });
    expect(REDDIT_DEMO_URL).toBe("https://www.reddit.com/r/webdev/");
    expect(FIRST_TOOL_PROMPT).toContain(FIRST_TOOL_NAME);
    expect(FIRST_TOOL_PROMPT).toContain(REDDIT_DEMO_URL);
    expect(MCP_CONFIG).toContain("packages/mcp/dist/index.js");
    expect(EXTENSION_RELEASE_URL).toBe(
      "https://github.com/robertn702/webmcp-today/releases/latest/download/webmcp-today-chrome.zip",
    );
    expect(QUICKSTART_PROMPT).toContain(EXTENSION_RELEASE_URL);
    expect(QUICKSTART_PROMPT).toContain("Download and extract the extension ZIP");
    expect(QUICKSTART_PROMPT).toContain("Developer mode");
    expect(QUICKSTART_PROMPT).toContain("Load unpacked");
    expect(QUICKSTART_PROMPT).toContain("setup_webmcp_bridge");
    expect(QUICKSTART_PROMPT).toContain("get_webmcp_bridge_status");
    expect(QUICKSTART_PROMPT).not.toContain("bun install");
    expect(QUICKSTART_PROMPT).not.toContain("@webmcp-today/extension...");
  });

  it("publishes a docs hub and keeps bridge quickstart free of stale CDP setup", async () => {
    const [quickstart, docs, landing] = await Promise.all([
      readFile(quickstartPath, "utf8"),
      readFile(docsPath, "utf8"),
      readFile(landingPath, "utf8"),
    ]);

    expect(docs).toContain('href="/docs/quickstart"');
    expect(docs).toContain("EXTENSION_RELEASE_URL");
    expect(landing).toContain("EXTENSION_RELEASE_URL");
    expect(quickstart).toContain("list_connected_webmcp_tabs");
    expect(quickstart).toContain("list_webmcp_tools");
    expect(quickstart).toContain("execute_webmcp_tool");
    expect(quickstart).toContain("setup_webmcp_bridge");
    expect(quickstart).toContain("get_webmcp_bridge_status");
    expect(quickstart).toContain("no package-only fallback");
    expect(quickstart).toContain("EXTENSION_RELEASE_URL");
    expect(quickstart).toContain("Developer mode");
    expect(quickstart).toContain("Load unpacked");
    expect(quickstart).not.toContain("BUILD_EXTENSION");
    expect(quickstart).not.toContain("chrome-mv3");
    expect(quickstart).not.toContain("Chrome DevTools MCP");
    expect(quickstart).not.toContain("remote-debugging-port");
    expect(quickstart).not.toContain("user-data-dir");
    expect(quickstart).not.toContain("DevToolsWebMCPSupport");
    expect(quickstart).not.toContain("chrome.debugger");
    expect(quickstart).not.toContain("debug port");
  });
});
