import { z } from "zod";
import {
  BRIDGE_PROTOCOL_VERSION,
  bridgeInstallResponseSchema,
  bridgeListInstallsResponseSchema,
  bridgePingResponseSchema,
  bridgeUninstallResponseSchema,
  type BridgeInstallResponse,
  type BridgeListInstallsResponse,
  type BridgePingResponse,
  type BridgeUninstallResponse,
} from "@robertn702/webmcp-cafe-schema";
import { env } from "@/env";

// Page side of the install bridge (packages/schema/src/bridge.ts is the
// protocol; the extension side is apps/extension/src/lib/install-bridge.ts).
// window.chrome.runtime only EXISTS on a page when some installed extension
// lists the site in externally_connectable, so absence of the API, a
// lastError, and a timeout all mean "our extension isn't there" — the caller
// only ever branches on ok / absent / invalid, never on Chrome internals.

export type BridgeResult<T> =
  | { status: "ok"; data: T }
  /** No extension answered (not installed, or our site isn't connectable). */
  | { status: "absent" }
  /** Something answered, but not in our protocol — fail closed. */
  | { status: "invalid" };

const PROBE_TIMEOUT_MS = 1500;

/** The ID that answered a ping; undefined = not probed yet, null = none did. */
let probedExtensionId: string | null | undefined;

function configuredExtensionIds(): string[] {
  return (env.NEXT_PUBLIC_WEBMCP_EXTENSION_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function sendToExtension(extensionId: string, message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const runtime = globalThis.chrome?.runtime;
    if (runtime === undefined || typeof runtime.sendMessage !== "function") {
      reject(new Error("extension-absent"));
      return;
    }
    const timer = setTimeout(() => reject(new Error("extension-timeout")), PROBE_TIMEOUT_MS);
    try {
      runtime.sendMessage(extensionId, message, (response: unknown) => {
        clearTimeout(timer);
        const lastError = runtime.lastError;
        if (lastError !== undefined) {
          reject(new Error(lastError.message ?? "extension-lastError"));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error("extension-sendMessage-threw"));
    }
  });
}

/** Ping each configured ID in order and cache the first that answers in
 *  protocol. The dev-key ID and the CWS ID differ, hence the list. */
async function probeExtensionId(): Promise<string | null> {
  if (probedExtensionId !== undefined) return probedExtensionId;
  for (const id of configuredExtensionIds()) {
    try {
      const response = await sendToExtension(id, { v: BRIDGE_PROTOCOL_VERSION, type: "ping" });
      if (bridgePingResponseSchema.safeParse(response).success) {
        probedExtensionId = id;
        return id;
      }
    } catch {
      // Absent or timed out — try the next ID.
    }
  }
  probedExtensionId = null;
  return null;
}

async function call<T>(message: unknown, schema: z.ZodType<T>): Promise<BridgeResult<T>> {
  const id = await probeExtensionId();
  if (id === null) return { status: "absent" };

  let response: unknown;
  try {
    response = await sendToExtension(id, message);
  } catch {
    // The probed winner stopped answering (uninstalled?) — re-probe next call.
    probedExtensionId = undefined;
    return { status: "absent" };
  }
  const parsed = schema.safeParse(response);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "invalid" };
}

export function pingExtension(): Promise<BridgeResult<BridgePingResponse>> {
  return call({ v: BRIDGE_PROTOCOL_VERSION, type: "ping" }, bridgePingResponseSchema);
}

export function installPackage(
  packageId: string,
  versionId: string,
): Promise<BridgeResult<BridgeInstallResponse>> {
  return call(
    { v: BRIDGE_PROTOCOL_VERSION, type: "install", packageId, versionId },
    bridgeInstallResponseSchema,
  );
}

export function uninstallPackage(
  packageId: string,
): Promise<BridgeResult<BridgeUninstallResponse>> {
  return call(
    { v: BRIDGE_PROTOCOL_VERSION, type: "uninstall", packageId },
    bridgeUninstallResponseSchema,
  );
}

export function listInstalls(): Promise<BridgeResult<BridgeListInstallsResponse>> {
  return call(
    { v: BRIDGE_PROTOCOL_VERSION, type: "list-installs" },
    bridgeListInstallsResponseSchema,
  );
}

/** Test hook: forget the probed extension ID. */
export function resetExtensionBridgeProbe(): void {
  probedExtensionId = undefined;
}
