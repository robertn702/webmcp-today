import { checkState, deepQueryAll, isVisible, query, queryAll } from "./dom.js";

// Waiting + extraction, ported from Joakim Selemyr's webmcp-extension (MIT).

export function waitForSelector(
  selector: string,
  state: "visible" | "exists" | "hidden" = "visible",
  timeout = 5000,
): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const el = query(selector);
      if (checkState(el, state)) return resolve();
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timeout waiting for ${selector}`));
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

export function waitForClickable(
  selector: string,
  params?: Record<string, unknown>,
  timeout = 5000,
): Promise<HTMLElement | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = (): void => {
      const el = query(selector, params);
      if (el instanceof HTMLElement && isVisible(el)) {
        const disabled = Reflect.get(el, "disabled");
        if (disabled !== true) return resolve(el);
      }
      if (Date.now() - start > timeout) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}

export function extractResult(
  selector: string,
  mode: "text" | "html" | "list" | "table" | "attribute",
  attribute?: string,
): unknown {
  if (mode === "list") {
    return queryAll(selector).map((el) => el.textContent?.trim() ?? "");
  }

  if (mode === "table") {
    return queryAll(`${selector} tr`).map((row) =>
      deepQueryAll("td, th", row).map((c) => c.textContent?.trim() ?? ""),
    );
  }

  const el = query(selector);
  if (!el) return null;

  if (mode === "html") return el.innerHTML;
  if (mode === "attribute" && attribute) return el.getAttribute(attribute);
  return el.textContent?.trim() ?? "";
}
