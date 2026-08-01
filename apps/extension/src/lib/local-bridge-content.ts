import {
  contentBridgeErrorResponseSchema,
  contentBridgeRequestSchema,
  jsonValueSchema,
  localBridgeToolDescriptorSchema,
  type ContentBridgeResponse,
  type LocalBridgeDocument,
  type LocalBridgeToolDescriptor,
} from "@robertn702/webmcp-today-schema";
import type { ToolConsumerModelContextLike } from "./model-context.js";

export interface LocalBridgeContentDeps {
  getConsumer: () => ToolConsumerModelContextLike | undefined;
  getTitle: () => string;
  getUrl: () => string;
}

interface LiveTool {
  name: string;
  description: string;
  inputSchema?: string;
  origin: string;
  annotations?: Record<string, unknown>;
}

/**
 * Owns live WebMCP handles for one content-script document. The bridge never
 * sends a tool over extension/native IPC: execution resolves a fresh tool after
 * first checking both document and tool-list generations.
 */
export class LocalBridgeContent {
  private documentGeneration = newGeneration();
  private toolsGeneration = newGeneration();
  private documentUrl: string;

  constructor(private readonly deps: LocalBridgeContentDeps) {
    this.documentUrl = deps.getUrl();
  }

  installToolChangeListener(): void {
    const consumer = this.deps.getConsumer();
    if (!consumer?.addEventListener) return;
    consumer.addEventListener("toolchange", () => {
      this.toolsGeneration = newGeneration();
    });
  }

  /** Call for every navigation pass, including SPA navigation. */
  invalidateDocument(): void {
    this.documentUrl = this.deps.getUrl();
    this.documentGeneration = newGeneration();
    this.toolsGeneration = newGeneration();
  }

  async handleMessage(message: unknown): Promise<ContentBridgeResponse> {
    const request = contentBridgeRequestSchema.safeParse(message);
    if (!request.success) return contentError("tool-error", "Invalid local bridge request.");
    this.invalidateIfUrlChanged();

    const consumer = this.deps.getConsumer();
    if (!consumer) {
      return contentError(
        "webmcp-unavailable",
        "WebMCP tool discovery and execution are unavailable.",
      );
    }

    if (request.data.type === "webmcp-today:local-bridge:list-tools") {
      const documentGeneration = this.documentGeneration;
      const toolsGeneration = this.toolsGeneration;
      try {
        const tools = await consumer.getTools();
        this.invalidateIfUrlChanged();
        if (!this.hasGenerations(documentGeneration, toolsGeneration)) return staleToolError();
        const descriptors = descriptorsFromLiveTools(tools);
        if (!descriptors.ok) return contentError("tool-error", descriptors.message);
        if (!this.hasGenerations(documentGeneration, toolsGeneration)) return staleToolError();
        return { ok: true, document: this.document(), tools: descriptors.tools };
      } catch {
        this.invalidateIfUrlChanged();
        if (!this.hasGenerations(documentGeneration, toolsGeneration)) return staleToolError();
        return contentError("tool-error", "WebMCP refused tool discovery for this document.");
      }
    }

    const executeRequest = request.data;

    if (
      executeRequest.documentGeneration !== this.documentGeneration ||
      executeRequest.toolsGeneration !== this.toolsGeneration
    ) {
      return contentError("stale-tool", "The page or its WebMCP tools changed; list tools again.");
    }

    let tools: unknown[];
    try {
      tools = await consumer.getTools();
      this.invalidateIfUrlChanged();
      if (!this.hasGenerations(executeRequest.documentGeneration, executeRequest.toolsGeneration)) {
        return staleToolError();
      }
    } catch {
      this.invalidateIfUrlChanged();
      if (!this.hasGenerations(executeRequest.documentGeneration, executeRequest.toolsGeneration)) {
        return staleToolError();
      }
      return contentError("tool-error", "WebMCP refused tool discovery for this document.");
    }
    const liveTool = tools.find((tool) => {
      if (!isLiveTool(tool)) return false;
      return tool.name === executeRequest.toolName && tool.origin === executeRequest.toolOrigin;
    });
    if (!liveTool)
      return contentError("stale-tool", "The selected WebMCP tool is no longer available.");

    this.invalidateIfUrlChanged();
    if (!this.hasGenerations(executeRequest.documentGeneration, executeRequest.toolsGeneration)) {
      return staleToolError();
    }
    try {
      const result = await consumer.executeTool(liveTool, executeRequest.inputJson);
      const parsedResult = jsonValueSchema.safeParse(result === undefined ? null : result);
      if (!parsedResult.success) {
        return contentError("tool-error", "WebMCP returned a non-serializable tool result.");
      }
      return { ok: true, document: this.document(), result: parsedResult.data };
    } catch {
      return contentError("tool-error", "WebMCP tool execution failed.");
    }
  }

  private document(): LocalBridgeDocument {
    const url = this.documentUrl;
    try {
      new URL(url);
    } catch {
      // The browser document location should always be a URL. Refuse rather
      // than passing an unvalidated location through the native boundary.
      return {
        generation: this.documentGeneration,
        toolsGeneration: this.toolsGeneration,
        title: this.deps.getTitle(),
        url: "about:blank",
      };
    }
    return {
      generation: this.documentGeneration,
      toolsGeneration: this.toolsGeneration,
      title: this.deps.getTitle(),
      url,
    };
  }

  private invalidateIfUrlChanged(): void {
    if (this.deps.getUrl() !== this.documentUrl) this.invalidateDocument();
  }

  private hasGenerations(documentGeneration: string, toolsGeneration: string): boolean {
    return (
      this.documentGeneration === documentGeneration && this.toolsGeneration === toolsGeneration
    );
  }
}

function descriptorsFromLiveTools(
  tools: unknown[],
): { ok: true; tools: LocalBridgeToolDescriptor[] } | { ok: false; message: string } {
  const descriptors: LocalBridgeToolDescriptor[] = [];
  for (const tool of tools) {
    if (!isLiveTool(tool)) continue;
    const parsed = descriptorFromLiveTool(tool);
    if (!parsed) return { ok: false, message: "WebMCP returned an invalid tool descriptor." };
    descriptors.push(parsed);
  }
  return { ok: true, tools: descriptors };
}

function descriptorFromLiveTool(tool: LiveTool): LocalBridgeToolDescriptor | undefined {
  const annotations =
    tool.annotations === undefined ? undefined : jsonValueSchema.safeParse(tool.annotations);
  if (annotations !== undefined && !annotations.success) return undefined;
  const candidate = {
    name: tool.name,
    description: tool.description,
    ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
    origin: tool.origin,
    ...(annotations?.success ? { annotations: annotations.data } : {}),
  };
  const parsed = localBridgeToolDescriptorSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function isLiveTool(value: unknown): value is LiveTool {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "name") === "string" &&
    typeof Reflect.get(value, "description") === "string" &&
    (Reflect.get(value, "inputSchema") === undefined ||
      typeof Reflect.get(value, "inputSchema") === "string") &&
    typeof Reflect.get(value, "origin") === "string"
  );
}

function contentError(
  code: "stale-tool" | "tool-error" | "webmcp-unavailable",
  message: string,
): ContentBridgeResponse {
  return contentBridgeErrorResponseSchema.parse({ ok: false, error: { code, message } });
}

function staleToolError(): ContentBridgeResponse {
  return contentError("stale-tool", "The page or its WebMCP tools changed; list tools again.");
}

function newGeneration(): string {
  return crypto.randomUUID();
}
