import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { curatedPackages } from "@webmcp-today/curated-packages";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { BridgePingResponse } from "@webmcp-today/schema";

vi.mock("@/lib/extension-bridge", () => ({
  pingExtension: () => Promise.resolve({ status: "absent" }),
  resetExtensionBridgeProbe: () => undefined,
}));

import { WebMcpReadinessView } from "@/components/webmcp-readiness";
import {
  FIRST_TOOL_NAME,
  FIRST_TOOL_PROMPT,
  DOWNLOAD_EXTENSION,
  EXTENSION_RELEASE_URL,
  EXTENSION_RELEASES_URL,
  MCP_CLIENT_CONFIGS,
  MCP_CLIENT_CONFIG_PROMPT,
  MCP_BRIDGE_PACKAGE,
  QUICKSTART_PROMPT,
  REDDIT_DEMO_URL,
  REDDIT_PACKAGE_DOMAIN,
  REDDIT_TOOL_COUNT,
} from "@/app/(registry)/docs/content";
import { extensionCheckpoint } from "@/lib/onboarding-preflight";

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

function readinessView(extension: Parameters<typeof WebMcpReadinessView>[0]["extension"]): string {
  return renderToStaticMarkup(
    <WebMcpReadinessView extension={extension} onCheckAgain={() => undefined} />,
  );
}

describe("bridge quickstart", () => {
  it("maps installed-extension probes to actionable readiness states", () => {
    expect(extensionCheckpoint({ status: "absent" })).toBe("absent");
    expect(extensionCheckpoint({ status: "invalid" })).toBe("absent");
    expect(
      extensionCheckpoint({ status: "ok", data: { ...PING_OK, storageReadable: false } }),
    ).toBe("unreadable");
    expect(extensionCheckpoint({ status: "ok", data: PING_OK })).toBe("ready");
  });

  it("renders the extension checkpoint and demotes the flag to a native-agent-only note", () => {
    const waiting = readinessView("waiting");
    expect(waiting).toContain("Load the extension, then check again.");
    expect(waiting).toContain("The WebMCP testing flag is only needed for Chrome");
    expect(waiting).not.toContain("chrome://flags/#enable-webmcp-testing");
    expect(waiting).not.toContain('aria-label="Copy chrome://flags/#enable-webmcp-testing"');

    const ready = readinessView("ready");
    expect(ready).toContain("The extension answered this site and its storage is readable.");
    expect(ready).not.toContain("native host");
    expect(ready).not.toContain("MCP configuration");
    expect(ready).not.toContain("list_connected_webmcp_tabs");
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
    expect(EXTENSION_RELEASE_URL).toBe(
      "https://github.com/robertn702/webmcp-today/releases/latest/download/webmcp-today-extension.zip",
    );
    expect(DOWNLOAD_EXTENSION).toContain(EXTENSION_RELEASE_URL);
    expect(DOWNLOAD_EXTENSION).toContain("~/Downloads/webmcp-today-extension.zip");
    expect(DOWNLOAD_EXTENSION).toContain("~/Downloads/webmcp-today-extension");
    expect(EXTENSION_RELEASES_URL).toBe(
      "https://github.com/robertn702/webmcp-today/releases/latest",
    );
    expect(QUICKSTART_PROMPT).toContain(EXTENSION_RELEASE_URL);
    expect(QUICKSTART_PROMPT).toContain("Download and extract the extension ZIP");
    expect(QUICKSTART_PROMPT).toContain("Developer mode");
    expect(QUICKSTART_PROMPT).toContain("Load unpacked");
    expect(QUICKSTART_PROMPT).toContain("## Prerequisites");
    expect(QUICKSTART_PROMPT).toContain("## 5. Verify the live tool call");
    expect(QUICKSTART_PROMPT).toContain("Ask which browser I will use (Chrome or Brave)");
    expect(QUICKSTART_PROMPT).toContain("Do not infer the MCP client from your own runtime");
    expect(QUICKSTART_PROMPT).toContain("AppleScript");
    expect(QUICKSTART_PROMPT).toContain("do not use the browser's `open location` command");
    expect(QUICKSTART_PROMPT).toContain(`npx --yes ${MCP_BRIDGE_PACKAGE}`);
    expect(QUICKSTART_PROMPT).toContain(MCP_CLIENT_CONFIG_PROMPT);
    expect(QUICKSTART_PROMPT).toContain("execute_webmcp_tool");
    expect(FIRST_TOOL_PROMPT).toContain("execute_webmcp_tool");
    expect(MCP_CLIENT_CONFIGS.map((client) => client.name)).toEqual([
      "OpenCode",
      "Claude Code",
      "Codex",
      "Cursor",
      "VS Code",
    ]);
    expect(MCP_CLIENT_CONFIGS.map((client) => client.configuration)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`"command": ["npx", "--yes", "${MCP_BRIDGE_PACKAGE}"]`),
        expect.stringContaining("claude mcp add --transport stdio"),
        expect.stringContaining('command = "npx"'),
        expect.stringContaining('"type": "stdio"'),
      ]),
    );
    expect(QUICKSTART_PROMPT).toContain("setup_webmcp_bridge");
    expect(QUICKSTART_PROMPT).toContain("get_webmcp_bridge_status");
    expect(QUICKSTART_PROMPT).toContain(`npx --yes ${MCP_BRIDGE_PACKAGE}`);
    expect(QUICKSTART_PROMPT).not.toContain("npm install --global");
    expect(QUICKSTART_PROMPT).not.toContain("@webmcp-today/extension...");
  });

  it("runs the readiness check only after the extension is loaded", () => {
    // The check pings the extension, so the prompt must not assert "connected"
    // before the download and Load unpacked steps.
    const loadIndex = QUICKSTART_PROMPT.indexOf("Load unpacked");
    const readinessIndex = QUICKSTART_PROMPT.indexOf("browser-readiness check");
    expect(loadIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeGreaterThan(loadIndex);
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
    expect(quickstart).toContain("built-in fallback");
    expect(quickstart).toContain("EXTENSION_RELEASE_URL");
    expect(quickstart).toContain("EXTENSION_RELEASES_URL");
    expect(quickstart).toContain("DOWNLOAD_EXTENSION");
    expect(quickstart).toContain("McpClientConfigs");
    expect(quickstart).toContain("Developer mode");
    expect(quickstart).toContain("Load unpacked");
    expect(quickstart).toContain("requires macOS and Chrome or Brave");
    expect(quickstart).toContain('<CopyButton text={QUICKSTART_PROMPT} label="Copy page" />');
    expect(quickstart).not.toContain("Copy complete Markdown instructions");
    expect(quickstart).not.toContain("Copy OpenCode configuration");
    expect(quickstart).not.toContain("Copy first-tool prompt");
    expect(quickstart).toContain('id="load-extension"');
    expect(quickstart).toContain('id="configure-mcp-client"');
    expect(quickstart).toContain('id="install-reddit-package"');
    expect(quickstart).toContain('id="make-first-tool-call"');
    expect(quickstart).toContain("scroll-mt-20");
    expect(quickstart).toContain("href={`#${id}`}");
    expect(quickstart).not.toContain('className="mt-10 border-l-2 border-brand/30 pl-5"');
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
