// DOM querying ported from Joakim Selemyr's webmcp-extension (MIT):
// shadow-DOM-deep traversal and a :has-text("...") pseudo-selector.

export function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ""));
}

export function deepQuery(selector: string, root: Document | ShadowRoot = document): Element | null {
  const el = root.querySelector(selector);
  if (el) return el;
  for (const host of root.querySelectorAll("*")) {
    if (host.shadowRoot) {
      const found = deepQuery(selector, host.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

export function deepQueryAll(
  selector: string,
  root: Document | ShadowRoot | Element = document,
): Element[] {
  const results: Element[] = [...root.querySelectorAll(selector)];
  for (const host of root.querySelectorAll("*")) {
    if (host.shadowRoot) {
      results.push(...deepQueryAll(selector, host.shadowRoot));
    }
  }
  return results;
}

// :has-text("...") — handles both quote styles and escaped quotes.
const HAS_TEXT_RE = /^(.+?):has-text\((?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\)\s*(.*)$/;

function matchesText(el: Element, text: string): boolean {
  const normalized = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return normalized.includes(text.trim());
}

export function query(selector: string, params?: Record<string, unknown>): Element | null {
  const resolved = params ? interpolate(selector, params) : selector;
  const match = resolved.match(HAS_TEXT_RE);
  if (!match) return deepQuery(resolved);

  const [, base, dq, sq, suffix] = match;
  const text = dq ?? sq ?? "";
  if (!base) return null;
  for (const el of deepQueryAll(base)) {
    if (matchesText(el, text)) {
      return suffix ? el.querySelector(suffix) : el;
    }
  }
  return null;
}

export function queryAll(selector: string, params?: Record<string, unknown>): Element[] {
  const resolved = params ? interpolate(selector, params) : selector;
  const match = resolved.match(HAS_TEXT_RE);
  if (!match) return deepQueryAll(resolved);

  const [, base, dq, sq, suffix] = match;
  const text = dq ?? sq ?? "";
  if (!base) return [];
  const results: Element[] = [];
  for (const el of deepQueryAll(base)) {
    if (!matchesText(el, text)) continue;
    if (suffix) {
      const child = el.querySelector(suffix);
      if (child) results.push(child);
    } else {
      results.push(el);
    }
  }
  return results;
}

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

export function checkState(el: Element | null, state: "visible" | "exists" | "hidden"): boolean {
  if (state === "hidden") return !el || !isVisible(el);
  if (state === "exists") return el !== null;
  return el !== null && isVisible(el);
}
