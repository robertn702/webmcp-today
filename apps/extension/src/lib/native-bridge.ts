import {
  LOCAL_BRIDGE_MAX_NATIVE_MESSAGE_BYTES,
  LOCAL_BRIDGE_NATIVE_HOST_NAME,
  LOCAL_BRIDGE_PROTOCOL_VERSION,
  LOCAL_BRIDGE_REQUEST_ID_MAX_LENGTH,
  localBridgeErrorResponseSchema,
  localBridgeResponseSchema,
  type LocalBridgeResponse,
} from "@webmcp-today/schema";

export interface NativePortLike {
  onDisconnect: { addListener(listener: () => void): void };
  onMessage: { addListener(listener: (message: unknown) => void): void };
  postMessage(message: unknown): void;
}

export interface NativeBridgeDeps {
  connectNative: (hostName: string) => NativePortLike;
  handle: (message: unknown) => Promise<LocalBridgeResponse>;
  scheduleReconnect: (callback: () => void) => void;
  getLastErrorMessage?: () => string | undefined;
}

/** Keep the native port alive when Chrome permits it, but never retain request
 * state in the MV3 worker. The native process and MCP server reconnect safely. */
export function startNativeBridge(deps: NativeBridgeDeps): void {
  let reconnectScheduled = false;

  const connect = () => {
    reconnectScheduled = false;
    let port: NativePortLike;
    try {
      port = deps.connectNative(LOCAL_BRIDGE_NATIVE_HOST_NAME);
    } catch {
      scheduleReconnect();
      return;
    }

    let disconnected = false;
    const close = () => {
      if (disconnected) return;
      disconnected = true;
      const message = deps.getLastErrorMessage?.();
      if (message) {
        console.warn(`[webmcp-today] Native bridge disconnected: ${message}`);
      }
      scheduleReconnect();
    };
    const postResponse = (response: LocalBridgeResponse) => {
      if (disconnected) return;
      try {
        port.postMessage(response);
      } catch {
        close();
      }
    };
    const errorResponse = (requestId: string, code: "bridge-unavailable" | "invalid-response") =>
      localBridgeErrorResponseSchema.parse({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "error",
        requestId,
        error:
          code === "bridge-unavailable"
            ? {
                code,
                message: "The Chrome extension could not complete the local bridge request.",
              }
            : {
                code,
                message: "The Chrome extension returned an invalid local bridge response.",
              },
      });
    const route = async (request: unknown) => {
      const requestId = requestIdFromUnknown(request);
      let response: LocalBridgeResponse;
      try {
        response = await deps.handle(request);
      } catch {
        postResponse(errorResponse(requestId, "bridge-unavailable"));
        return;
      }
      const parsed = localBridgeResponseSchema.safeParse(response);
      if (!parsed.success || parsed.data.requestId !== requestId) {
        postResponse(errorResponse(requestId, "invalid-response"));
        return;
      }
      const encoded = new TextEncoder().encode(JSON.stringify(parsed.data));
      if (encoded.byteLength <= LOCAL_BRIDGE_MAX_NATIVE_MESSAGE_BYTES) {
        postResponse(parsed.data);
        return;
      }
      postResponse(
        localBridgeErrorResponseSchema.parse({
          v: LOCAL_BRIDGE_PROTOCOL_VERSION,
          type: "error",
          requestId,
          error: {
            code: "tool-error",
            message: "WebMCP tool output exceeded Chrome native messaging's 1 MB limit.",
          },
        }),
      );
    };

    port.onMessage.addListener((message) => {
      void route(message);
    });
    port.onDisconnect.addListener(close);
  };

  const scheduleReconnect = () => {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    try {
      deps.scheduleReconnect(connect);
    } catch {
      reconnectScheduled = false;
    }
  };

  connect();
}

function requestIdFromUnknown(message: unknown): string {
  if (typeof message !== "object" || message === null) return "invalid-request";
  const requestId = Reflect.get(message, "requestId");
  return typeof requestId === "string" &&
    requestId.length > 0 &&
    requestId.length <= LOCAL_BRIDGE_REQUEST_ID_MAX_LENGTH
    ? requestId
    : "invalid-request";
}
