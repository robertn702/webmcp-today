// WebMCP feature detection. The 21 Jul 2026 draft moved the API from
// navigator.modelContext to document.modelContext (Chrome 150 deprecates the
// navigator location) — always check document first.

import type { McpResult } from "@webmcp-today/engine";

export type { McpResult, McpTextContent } from "@webmcp-today/engine";

export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<McpResult>;
}

export interface ModelContextLike {
  /** Promise-based in the 2026 draft; rejects on duplicate tool names. */
  registerTool(descriptor: ToolRegistration, options?: { signal?: AbortSignal }): Promise<unknown>;
}

/** The consumer surface is deliberately separate from registration: Chrome may
 * expose one while withholding the other as WebMCP evolves. */
export interface ToolConsumerModelContextLike {
  getTools(): Promise<unknown[]>;
  executeTool(
    tool: unknown,
    inputJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  addEventListener?: (type: string, listener: EventListener) => void;
}

function isModelContext(value: unknown): value is ModelContextLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "registerTool") === "function"
  );
}

function isToolConsumerModelContext(value: unknown): value is ToolConsumerModelContextLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "getTools") === "function" &&
    typeof Reflect.get(value, "executeTool") === "function"
  );
}

function modelContextCandidates(): unknown[] {
  return [Reflect.get(document, "modelContext"), Reflect.get(navigator, "modelContext")];
}

export function getModelContext(): ModelContextLike | undefined {
  for (const candidate of modelContextCandidates()) {
    if (isModelContext(candidate)) return candidate;
  }
  return undefined;
}

export function getToolConsumerModelContext(): ToolConsumerModelContextLike | undefined {
  for (const candidate of modelContextCandidates()) {
    if (isToolConsumerModelContext(candidate)) return candidate;
  }
  return undefined;
}
