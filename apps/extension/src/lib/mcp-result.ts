import { TOOL_OUTPUT_MAX } from "@robertn702/webmcp-cafe-schema";
import type { McpResult } from "./model-context.js";

// Shared output wrapper for both the DOM and API executors. Enforces Chrome's
// ~1.5K tool-output budget (TOOL_OUTPUT_MAX) with a clear truncation marker so
// oversized responses are trimmed identically everywhere.
export function mcpResult(text: string): McpResult {
  const truncated =
    text.length > TOOL_OUTPUT_MAX ? `${text.slice(0, TOOL_OUTPUT_MAX)}… (truncated)` : text;
  return { content: [{ type: "text", text: truncated }] };
}
