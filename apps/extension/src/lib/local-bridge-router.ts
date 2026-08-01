import {
  LOCAL_BRIDGE_PROTOCOL_VERSION,
  LOCAL_BRIDGE_REQUEST_ID_MAX_LENGTH,
  contentBridgeResponseSchema,
  localBridgeErrorResponseSchema,
  localBridgeRequestSchema,
  localBridgeResponseSchema,
  type ContentBridgeResponse,
  type LocalBridgeError,
  type LocalBridgeRequest,
  type LocalBridgeResponse,
} from "@robertn702/webmcp-today-schema";

export interface LocalBridgeRouterDeps {
  /** The active tab in the last-focused browser window: the user's selected target. */
  getSelectedTabId: () => Promise<number | undefined>;
  sendToContent: (tabId: number, message: unknown) => Promise<unknown>;
}

/**
 * Routes native-host requests to the selected tab. There is no per-request
 * worker state: the request id follows the message end-to-end, so a service
 * worker restart cannot accidentally deliver an old response to a new call.
 */
export function createLocalBridgeRouter(deps: LocalBridgeRouterDeps): {
  handle(message: unknown): Promise<LocalBridgeResponse>;
} {
  return { handle: (message) => handle(message, deps) };
}

async function handle(message: unknown, deps: LocalBridgeRouterDeps): Promise<LocalBridgeResponse> {
  const request = localBridgeRequestSchema.safeParse(message);
  if (!request.success) return invalidRequestResponse(message);

  if (request.data.type === "list-tabs") return listTabs(request.data, deps);

  const selectedTabId = await selectedTabIdOrError(request.data, deps);
  if (typeof selectedTabId !== "number") return selectedTabId;

  const response = await contentResponse(
    selectedTabId,
    request.data.type === "list-tools"
      ? { v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "webmcp-today:local-bridge:list-tools" }
      : {
          v: LOCAL_BRIDGE_PROTOCOL_VERSION,
          type: "webmcp-today:local-bridge:execute-tool",
          documentGeneration: request.data.documentGeneration,
          toolsGeneration: request.data.toolsGeneration,
          toolName: request.data.toolName,
          toolOrigin: request.data.toolOrigin,
          inputJson: request.data.inputJson,
        },
    deps,
  );
  if ("error" in response) return errorResponse(request.data.requestId, response.error);

  if (request.data.type === "list-tools") {
    if (!("tools" in response)) {
      return errorResponse(request.data.requestId, invalidResponseError());
    }
    return localBridgeResponseSchema.parse({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tools",
      requestId: request.data.requestId,
      tabId: selectedTabId,
      document: response.document,
      tools: response.tools,
    });
  }

  if (!("result" in response)) return errorResponse(request.data.requestId, invalidResponseError());
  return localBridgeResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "tool-result",
    requestId: request.data.requestId,
    tabId: selectedTabId,
    document: response.document,
    result: response.result,
  });
}

async function listTabs(
  request: Extract<LocalBridgeRequest, { type: "list-tabs" }>,
  deps: LocalBridgeRouterDeps,
): Promise<LocalBridgeResponse> {
  const tabId = await deps.getSelectedTabId();
  if (tabId === undefined) {
    return localBridgeResponseSchema.parse({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tabs",
      requestId: request.requestId,
      tabs: [],
    });
  }

  const response = await contentResponse(
    tabId,
    { v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "webmcp-today:local-bridge:list-tools" },
    deps,
  );
  // A page without a reachable consumer API is not an eligible bridge tab.
  if ("error" in response || !response.ok || !("tools" in response)) {
    return localBridgeResponseSchema.parse({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tabs",
      requestId: request.requestId,
      tabs: [],
    });
  }
  return localBridgeResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "tabs",
    requestId: request.requestId,
    tabs: [{ tabId, document: response.document, toolCount: response.tools.length }],
  });
}

async function selectedTabIdOrError(
  request: Exclude<LocalBridgeRequest, { type: "list-tabs" }>,
  deps: LocalBridgeRouterDeps,
): Promise<number | LocalBridgeResponse> {
  const selectedTabId = await deps.getSelectedTabId();
  if (selectedTabId === undefined) {
    return errorResponse(request.requestId, {
      code: "tab-unavailable",
      message: "No selected browser tab is available.",
    });
  }
  if (selectedTabId !== request.tabId) {
    return errorResponse(request.requestId, {
      code: "tab-not-eligible",
      message: "The requested tab is not the user's selected visible tab.",
    });
  }
  return selectedTabId;
}

async function contentResponse(
  tabId: number,
  message: unknown,
  deps: LocalBridgeRouterDeps,
): Promise<ContentBridgeResponse | { error: LocalBridgeError }> {
  let raw: unknown;
  try {
    raw = await deps.sendToContent(tabId, message);
  } catch {
    return {
      error: {
        code: "tab-unavailable",
        message: "The selected tab no longer has a reachable WebMCP Today content script.",
      },
    };
  }
  const parsed = contentBridgeResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : { error: invalidResponseError() };
}

function invalidRequestResponse(message: unknown): LocalBridgeResponse {
  const requestId = requestIdFromUnknown(message);
  return errorResponse(requestId, {
    code: "protocol-mismatch",
    message: "Invalid local bridge request.",
  });
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

function invalidResponseError(): LocalBridgeError {
  return {
    code: "invalid-response",
    message: "The content script returned an invalid local bridge response.",
  };
}

function errorResponse(requestId: string, error: LocalBridgeError): LocalBridgeResponse {
  return localBridgeErrorResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error,
  });
}
