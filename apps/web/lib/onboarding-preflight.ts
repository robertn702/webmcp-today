import type { BridgePingResponse } from "@robertn702/webmcp-today-schema";
import type { BridgeResult } from "@/lib/extension-bridge";

export type BrowserRemediation =
  | { family: "chrome"; flagUrl: string; label: string; isCandidate: false }
  | { family: "brave"; flagUrl: string; label: string; isCandidate: true }
  | { family: "edge"; flagUrl: string; label: string; isCandidate: true }
  | { family: "other" };

export type ExtensionCheckpoint = "absent" | "unreadable" | "ready";

/**
 * Mirrors the extension's document-first WebMCP lookup without registering a
 * probe tool on the registry page.
 */
export function hasWebMcpCapability(documentObject: object, navigatorObject: object): boolean {
  const modelContext =
    Reflect.get(documentObject, "modelContext") ?? Reflect.get(navigatorObject, "modelContext");

  return (
    typeof modelContext === "object" &&
    modelContext !== null &&
    typeof Reflect.get(modelContext, "registerTool") === "function"
  );
}

/** Browser identity picks instructions only; the runtime capability decides readiness. */
export function browserRemediation(navigatorObject: {
  userAgent: string;
  brave?: unknown;
}): BrowserRemediation {
  if (
    Reflect.get(navigatorObject, "brave") !== undefined ||
    /brave/i.test(navigatorObject.userAgent)
  ) {
    return {
      family: "brave",
      flagUrl: "brave://flags/#enable-webmcp-testing",
      label: "Brave",
      isCandidate: true,
    };
  }
  if (/edg\//i.test(navigatorObject.userAgent)) {
    return {
      family: "edge",
      flagUrl: "edge://flags/#enable-webmcp-testing",
      label: "Microsoft Edge",
      isCandidate: true,
    };
  }
  if (/chrome|chromium/i.test(navigatorObject.userAgent)) {
    return {
      family: "chrome",
      flagUrl: "chrome://flags/#enable-webmcp-testing",
      label: "Chrome",
      isCandidate: false,
    };
  }
  return { family: "other" };
}

export function extensionCheckpoint(result: BridgeResult<BridgePingResponse>): ExtensionCheckpoint {
  if (result.status !== "ok") return "absent";
  return result.data.storageReadable ? "ready" : "unreadable";
}
