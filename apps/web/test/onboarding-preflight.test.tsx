import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { BridgePingResponse } from "@robertn702/webmcp-today-schema";

vi.mock("@/lib/extension-bridge", () => ({
  pingExtension: () => Promise.resolve({ status: "absent" }),
  resetExtensionBridgeProbe: () => undefined,
}));

import { ExtensionReadinessView } from "@/components/extension-readiness";
import {
  browserRemediation,
  extensionCheckpoint,
  hasWebMcpCapability,
} from "@/lib/onboarding-preflight";

const PING_OK: BridgePingResponse = {
  ok: true,
  protocol: 1,
  engine: 1,
  extensionVersion: "0.0.1",
  storageReadable: true,
};

function readinessView(
  browser: Parameters<typeof ExtensionReadinessView>[0]["browser"],
  extension: Parameters<typeof ExtensionReadinessView>[0]["extension"],
): string {
  return renderToStaticMarkup(
    <ExtensionReadinessView
      browser={browser}
      extension={extension}
      remediation={browserRemediation({ userAgent: "Mozilla/5.0 Chrome/149.0" })}
      onCheckAgain={() => undefined}
    />,
  );
}

describe("onboarding preflight", () => {
  it("detects a document-first WebMCP API and a navigator fallback", () => {
    const registerTool = () => Promise.resolve();

    expect(hasWebMcpCapability({ modelContext: { registerTool } }, {})).toBe(true);
    expect(hasWebMcpCapability({}, { modelContext: { registerTool } })).toBe(true);
  });

  it("reports unavailable when neither location exposes registerTool", () => {
    expect(hasWebMcpCapability({ modelContext: {} }, {})).toBe(false);
    expect(hasWebMcpCapability({}, { modelContext: {} })).toBe(false);
  });

  it("performs a fresh capability evaluation when checked again", () => {
    const documentObject: { modelContext?: { registerTool: () => Promise<void> } } = {};

    expect(hasWebMcpCapability(documentObject, {})).toBe(false);
    documentObject.modelContext = { registerTool: () => Promise.resolve() };
    expect(hasWebMcpCapability(documentObject, {})).toBe(true);
  });

  it("selects browser-specific instructions without making a readiness decision", () => {
    expect(browserRemediation({ userAgent: "Mozilla/5.0 Brave/1.92" })).toMatchObject({
      family: "brave",
      flagUrl: "brave://flags/#enable-webmcp-testing",
    });
    expect(browserRemediation({ userAgent: "Mozilla/5.0 Chrome/149.0", brave: {} })).toMatchObject({
      family: "brave",
      flagUrl: "brave://flags/#enable-webmcp-testing",
    });
    expect(browserRemediation({ userAgent: "Mozilla/5.0 Edg/147.0" })).toMatchObject({
      family: "edge",
      flagUrl: "edge://flags/#enable-webmcp-testing",
    });
    expect(browserRemediation({ userAgent: "Mozilla/5.0 Chrome/149.0" })).toMatchObject({
      family: "chrome",
      flagUrl: "chrome://flags/#enable-webmcp-testing",
    });
    expect(browserRemediation({ userAgent: "Mozilla/5.0 Firefox/140.0" })).toEqual({
      family: "other",
    });
  });

  it("maps extension bridge responses to absent, unreadable, and ready checkpoints", () => {
    expect(extensionCheckpoint({ status: "absent" })).toBe("absent");
    expect(extensionCheckpoint({ status: "invalid" })).toBe("absent");
    expect(
      extensionCheckpoint({ status: "ok", data: { ...PING_OK, storageReadable: false } }),
    ).toBe("unreadable");
    expect(extensionCheckpoint({ status: "ok", data: PING_OK })).toBe("ready");
  });

  it("renders the flag-unavailable checkpoint and keeps the manual path available", () => {
    const view = readinessView("unavailable", "waiting");

    expect(view).toContain("WebMCP must be enabled before tools can register.");
    expect(view).toContain("chrome://flags/#enable-webmcp-testing");
    expect(view).toContain("paste it into the address bar");
    expect(view).not.toContain('href="chrome://flags/#enable-webmcp-testing"');
    expect(view).toContain("Check again");
  });

  it("renders absent and unreadable extension remediation", () => {
    expect(readinessView("ready", "absent")).toContain("No WebMCP Today extension answered.");
    expect(readinessView("ready", "unreadable")).toContain("Reinstall or update it");
  });

  it("renders the ready browser, extension, package, and target-site checkpoints", () => {
    const view = readinessView("ready", "ready");

    expect(view).toContain("WebMCP is available. Continue with the extension check.");
    expect(view).toContain("The extension is responding and its storage is readable.");
    expect(view).toContain("Browse the registry, then use a package page’s Install button.");
    expect(view).toContain("The popup is authoritative");
  });
});
