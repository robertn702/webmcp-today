import type { BridgePingResponse } from "@robertn702/webmcp-today-schema";
import type { BridgeResult } from "@/lib/extension-bridge";

export type BrowserGuidance =
  | { family: "chrome"; settingsPath: string; label: string }
  | { family: "brave"; settingsPath: string; label: string }
  | { family: "other" };

export type ExtensionCheckpoint = "absent" | "unreadable" | "ready";

/**
 * The extension registers tools while the local bridge consumes them. Both
 * APIs must exist; a browser name only selects remediation instructions.
 */
export function webMcpCapabilities(
  documentObject: object,
  navigatorObject: object,
): {
  registration: boolean;
  consumer: boolean;
} {
  const contexts = [
    Reflect.get(documentObject, "modelContext"),
    Reflect.get(navigatorObject, "modelContext"),
  ];
  let registration = false;
  let consumer = false;
  for (const modelContext of contexts) {
    if (typeof modelContext !== "object" || modelContext === null) continue;
    registration ||= typeof Reflect.get(modelContext, "registerTool") === "function";
    consumer ||=
      typeof Reflect.get(modelContext, "getTools") === "function" &&
      typeof Reflect.get(modelContext, "executeTool") === "function";
  }

  return { registration, consumer };
}

/** Browser identity provides the right copy-only settings path, never a capability verdict. */
export function browserGuidance(navigatorObject: {
  userAgent: string;
  brave?: unknown;
}): BrowserGuidance {
  if (
    Reflect.get(navigatorObject, "brave") !== undefined ||
    /brave/i.test(navigatorObject.userAgent)
  ) {
    return {
      family: "brave",
      settingsPath: "brave://flags/#enable-webmcp-testing",
      label: "Brave",
    };
  }
  if (/edg\//i.test(navigatorObject.userAgent)) return { family: "other" };
  if (/chrome|chromium/i.test(navigatorObject.userAgent)) {
    return {
      family: "chrome",
      settingsPath: "chrome://flags/#enable-webmcp-testing",
      label: "Chrome",
    };
  }
  return { family: "other" };
}

export function extensionCheckpoint(result: BridgeResult<BridgePingResponse>): ExtensionCheckpoint {
  if (result.status !== "ok") return "absent";
  return result.data.storageReadable ? "ready" : "unreadable";
}
