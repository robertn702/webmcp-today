import type { BridgePingResponse } from "@webmcp-today/schema";
import type { BridgeResult } from "@/lib/extension-bridge";

export type ExtensionCheckpoint = "absent" | "unreadable" | "ready";

/**
 * The bridge path needs only the extension: its built-in fallback registers
 * tools even when Chrome exposes no native WebMCP API (the testing flag only
 * matters for Chrome's own native agent), so the extension ping is the single
 * readiness signal the page can meaningfully ask for. Native host and MCP
 * client setup cannot be detected from the page.
 */
export function extensionCheckpoint(result: BridgeResult<BridgePingResponse>): ExtensionCheckpoint {
  if (result.status !== "ok") return "absent";
  return result.data.storageReadable ? "ready" : "unreadable";
}
