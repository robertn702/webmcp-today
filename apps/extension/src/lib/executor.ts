import { TOOL_OUTPUT_MAX, type ExecutionDescriptor } from "@robertn702/webmcp-cafe-schema";
import { executeStep } from "./executor-steps.js";
import { fillToolField } from "./fill.js";
import type { McpResult } from "./model-context.js";
import { submitSimpleMode } from "./submit.js";
import { extractResult, waitForSelector } from "./wait.js";

export function mcpResult(text: string): McpResult {
  const truncated =
    text.length > TOOL_OUTPUT_MAX ? `${text.slice(0, TOOL_OUTPUT_MAX)}… (truncated)` : text;
  return { content: [{ type: "text", text: truncated }] };
}

export async function executeTool(
  toolName: string,
  exec: ExecutionDescriptor,
  params: Record<string, unknown>,
  annotations?: Record<string, unknown>,
): Promise<McpResult> {
  try {
    return await executeToolInner(toolName, exec, params, annotations);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webmcp-cafe] Tool "${toolName}" threw:`, err);
    return mcpResult(`Error executing "${toolName}": ${msg}`);
  }
}

async function executeToolInner(
  toolName: string,
  exec: ExecutionDescriptor,
  params: Record<string, unknown>,
  annotations?: Record<string, unknown>,
): Promise<McpResult> {
  // Per-spec courtesy confirm for tools flagged destructive.
  if (annotations && Reflect.get(annotations, "destructiveHint") === true) {
    if (!window.confirm(`Allow "${toolName}" to make changes to this page?`)) {
      return mcpResult(`Tool "${toolName}" cancelled by user.`);
    }
  }

  // Multi-step mode
  if (exec.steps && exec.steps.length > 0) {
    let lastResult: unknown = null;
    for (const step of exec.steps) {
      lastResult = await executeStep(step, params);
    }
    if (Array.isArray(lastResult)) return mcpResult(lastResult.map(String).join("\n"));
    return mcpResult(lastResult != null ? String(lastResult) : `Executed ${toolName}`);
  }

  // Simple mode — fill fields
  const errors: string[] = [];
  for (const field of exec.fields ?? []) {
    const value = params[field.name] ?? field.defaultValue;
    if (value !== undefined) {
      const err = fillToolField(field, value);
      if (err) errors.push(`Field "${field.name}": ${err}`);
    }
  }
  const errorSuffix = errors.length > 0 ? `\nWarnings:\n${errors.join("\n")}` : "";

  // Submit — return immediately since it may cause navigation
  if (exec.autosubmit) {
    const outcome = await submitSimpleMode(exec, params, toolName);
    return mcpResult(outcome + errorSuffix);
  }

  if (errors.length > 0) {
    return mcpResult(`Error filling fields for "${toolName}":${errorSuffix}`);
  }

  // Extract result (no submit)
  if (exec.resultWaitSelector) {
    const wait = waitForSelector(exec.resultWaitSelector);
    if (exec.resultRequired) await wait;
    else await wait.catch(() => null);
  } else if (exec.resultDelay) {
    await new Promise((r) => setTimeout(r, exec.resultDelay));
  }

  if (exec.resultSelector) {
    const result = extractResult(
      exec.resultSelector,
      exec.resultExtract ?? "text",
      exec.resultAttribute,
    );
    if (Array.isArray(result)) {
      return mcpResult(
        result.map((row) => (Array.isArray(row) ? row.join(" | ") : String(row))).join("\n"),
      );
    }
    return mcpResult(result != null ? String(result) : "No result found");
  }

  return mcpResult(`Executed ${toolName}`);
}
