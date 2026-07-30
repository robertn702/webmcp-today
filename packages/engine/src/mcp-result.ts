import type { McpResult } from "./result.js";

// Shared output wrapper for both the DOM and API executors. Returns the text
// as-is. The ~1.5K tool-output cap (TOOL_OUTPUT_MAX) was removed for v1: verbose
// output is acceptable, and the right budget is model-dependent (Chrome's 1.5K is
// guidance, not an enforced limit). Revisit when we design output-budget
// customization — see docs/DECISIONS.md 2026-07-24.
export function mcpResult(text: string): McpResult {
  return { content: [{ type: "text", text }] };
}
