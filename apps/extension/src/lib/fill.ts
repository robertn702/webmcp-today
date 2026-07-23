import type { ToolField } from "@robertn702/webmcp-cafe-schema";
import { deepQuery, query } from "./dom.js";
import { fillContentEditable, findEditable } from "./fill-editable.js";

// Field filling, ported from Joakim Selemyr's webmcp-extension (MIT).

export function fillToolField(field: ToolField, value: unknown): string | null {
  if (field.type === "radio") {
    const option = field.options.find((o) => o.value === String(value));
    if (!option) return `No radio option matches value "${String(value)}"`;
    const el = deepQuery(option.selector);
    if (!(el instanceof HTMLInputElement)) {
      return `Radio option element not found: ${option.selector}`;
    }
    el.checked = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return null;
  }
  return fillField(field.selector, value);
}

/** Returns an error message, or null on success. */
export function fillField(selector: string, value: unknown): string | null {
  const el = query(selector);
  if (!(el instanceof HTMLElement)) return `Element not found: ${selector}`;

  const editableEl = findEditable(el);
  if (editableEl) {
    fillContentEditable(editableEl, value);
    return null;
  }

  if (el instanceof HTMLSelectElement) {
    el.value = String(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    el.checked = el.type === "radio" ? true : Boolean(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Native prototype setter bypasses React's value override — a direct
    // el.value write goes through React's setter and never updates state.
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, String(value));
    } else {
      el.value = String(value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return null;
}
