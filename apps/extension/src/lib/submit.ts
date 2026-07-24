import type { DomExecution } from "@robertn702/webmcp-cafe-schema";
import { deepQuery, interpolate, query } from "./dom.js";
import { waitForClickable } from "./wait.js";

// Simple-mode submit, ported from Joakim Selemyr's webmcp-extension (MIT).
// Returns a human-readable outcome string; the caller wraps it in an McpResult.

export async function submitSimpleMode(
  exec: DomExecution,
  params: Record<string, unknown>,
  toolName: string,
): Promise<string> {
  if (exec.submitAction === "enter") {
    const lastField = exec.fields?.at(-1);
    const target = lastField ? deepQuery(lastField.selector) : query(exec.selector, params);
    if (target instanceof HTMLElement) {
      const form = target.closest("form");
      if (form) {
        form.requestSubmit();
      } else {
        for (const type of ["keydown", "keypress", "keyup"]) {
          target.dispatchEvent(
            new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true, composed: true }),
          );
        }
      }
      return `Submitted ${toolName}`;
    }
    return `Error: Submit target not found for "${toolName}". Selector: ${exec.selector}`;
  }

  let clickTarget: HTMLElement | null;
  if (exec.submitSelector) {
    clickTarget = await waitForClickable(exec.submitSelector, params);
  } else {
    clickTarget = await waitForClickable(
      interpolate(exec.selector, params) + ' [type="submit"]',
      undefined,
      2500,
    );
    if (!clickTarget) clickTarget = await waitForClickable(exec.selector, params);
  }
  if (clickTarget) {
    clickTarget.click();
    return `Submitted ${toolName}`;
  }
  return `Error: Submit button not found for "${toolName}". Selector: ${exec.submitSelector ?? exec.selector}`;
}
