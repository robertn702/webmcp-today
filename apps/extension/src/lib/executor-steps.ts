import type { ActionStep } from "@robertn702/webmcp-cafe-schema";
import { checkState, interpolate, query } from "./dom.js";
import { fillField } from "./fill.js";
import { extractResult, waitForClickable, waitForSelector } from "./wait.js";

// Multi-step executor, ported from Joakim Selemyr's webmcp-extension (MIT).
// The reference implementation's `evaluate` step is intentionally not ported.

export async function executeStep(
  step: ActionStep,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (step.action) {
    case "navigate": {
      const url = interpolate(step.url, params);
      window.location.href = url;
      return `Navigating to ${url}`;
    }
    case "click": {
      const el = await waitForClickable(step.selector, params);
      if (!el) return `Error: Click target not found or not clickable: ${step.selector}`;
      // Native .click() so the event has isTrusted:true — sites like X.com
      // ignore synthetic events on their like/reply handlers.
      el.click();
      return null;
    }
    case "fill":
    case "select": {
      const selector = interpolate(step.selector, params);
      const value = interpolate(step.value, params);
      const err = fillField(selector, value);
      return err ? `Error: ${err}` : null;
    }
    case "wait": {
      // Soft wait — a timeout is non-fatal so slow pages don't crash the tool
      await waitForSelector(step.selector, step.state, step.timeout).catch(() => null);
      return null;
    }
    case "extract": {
      return extractResult(step.selector, step.extract, step.attribute);
    }
    case "scroll": {
      const el = query(step.selector, params);
      if (!el) return `Error: Scroll target not found: ${step.selector}`;
      el.scrollIntoView({ behavior: "smooth" });
      return null;
    }
    case "condition": {
      const el = query(step.selector, params);
      const branch = checkState(el, step.state) ? step.then : step.else;
      let result: unknown = null;
      for (const s of branch ?? []) {
        result = await executeStep(s, params);
      }
      return result;
    }
  }
}
