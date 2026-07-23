// WebMCP feature detection. The 21 Jul 2026 draft moved the API from
// navigator.modelContext to document.modelContext (Chrome 150 deprecates the
// navigator location) — always check document first.

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpResult {
  content: McpTextContent[];
}

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

function isModelContext(value: unknown): value is ModelContextLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "registerTool") === "function"
  );
}

export function getModelContext(): ModelContextLike | undefined {
  for (const candidate of [
    Reflect.get(document, "modelContext"),
    Reflect.get(navigator, "modelContext"),
  ]) {
    if (isModelContext(candidate)) return candidate;
  }
  return undefined;
}
