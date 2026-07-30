// The engine's return shape — the MCP tool-result contract every executor
// output conforms to. Lives here (not in the extension's model-context.ts)
// because the engine is host-agnostic; DOM feature detection stays in the
// extension.

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpResult {
  content: McpTextContent[];
}
