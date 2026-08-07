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
} from "@webmcp-today/schema";

export interface LocalBridgeRouterDeps {
  /** The active tab in the last-focused browser window: the user's selected target. */
  getSelectedTabId: () => Promise<number | undefined>;
  listEligibleTabIds: () => Promise<number[]>;
  focusTab: (tabId: number) => Promise<"focused" | "not-found" | "not-eligible">;
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
  if (request.data.type === "focus-tab") return focusTab(request.data, deps);

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
  const selectedTabId = await deps.getSelectedTabId();
  const tabIds = [
    ...(selectedTabId === undefined ? [] : [selectedTabId]),
    ...(await deps.listEligibleTabIds()),
  ].filter((tabId, index, candidates) => candidates.indexOf(tabId) === index);
  const tabs = await Promise.all(
    tabIds.map(async (tabId) => {
      const response = await contentResponse(
        tabId,
        { v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "webmcp-today:local-bridge:list-tools" },
        deps,
      );
      // A page without a reachable consumer API is not an eligible bridge tab.
      if ("error" in response || !response.ok || !("tools" in response)) return undefined;
      return { tabId, document: response.document, toolCount: response.tools.length };
    }),
  );
  return localBridgeResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "tabs",
    requestId: request.requestId,
    tabs: tabs.filter((tab) => tab !== undefined),
  });
}

async function focusTab(
  request: Extract<LocalBridgeRequest, { type: "focus-tab" }>,
  deps: LocalBridgeRouterDeps,
): Promise<LocalBridgeResponse> {
  const result = await deps.focusTab(request.tabId);
  if (result === "focused") {
    return localBridgeResponseSchema.parse({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tab-focused",
      requestId: request.requestId,
      tabId: request.tabId,
    });
  }
  if (result === "not-found") {
    return errorResponse(request.requestId, {
      code: "tab-unavailable",
      message:
        "The requested browser tab is no longer available. Use list_connected_webmcp_tabs, then retry.",
    });
  }
  return errorResponse(request.requestId, {
    code: "tab-not-eligible",
    message:
      "The requested tab does not match an installed package, so the local bridge may not focus it. Use list_connected_webmcp_tabs to choose a package-matched tab.",
  });
}

async function selectedTabIdOrError(
  request: Exclude<LocalBridgeRequest, { type: "list-tabs" | "focus-tab" }>,
  deps: LocalBridgeRouterDeps,
): Promise<number | LocalBridgeResponse> {
  const selectedTabId = await deps.getSelectedTabId();
  if (selectedTabId === undefined) {
    return errorResponse(request.requestId, {
      code: "tab-unavailable",
      message:
        "No active visible browser tab is available. Use list_connected_webmcp_tabs to find an eligible tab and focus_webmcp_tab to select it, or ask the user to open the target site in their browser.",
    });
  }
  if (selectedTabId !== request.tabId) {
    return errorResponse(request.requestId, {
      code: "tab-not-eligible",
      message:
        "The requested tab is not the user's active visible tab. Call focus_webmcp_tab with the target tabId from list_connected_webmcp_tabs, or ask the user to focus the tab in their browser, then retry.",
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
        message:
          "The user's active visible tab is no longer reachable. Ask the user to refresh the target site, or use list_connected_webmcp_tabs to find a reachable tab, then retry.",
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
