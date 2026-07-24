// Shared {{param}} template handling. Placeholders use DOUBLE braces and may
// only name a bound tool's inputSchema properties — the same convention DOM
// execution steps already use (see tool.ts). API templates (api.ts) reuse it.

export const TEMPLATE_RE = /\{\{(\w+)\}\}/g;

/**
 * Unique placeholder names referenced as {{name}} in `value` that are NOT a
 * property of `props`. Empty array = every placeholder resolves.
 *
 * NOTE: a literal "{{" that should reach the server verbatim (e.g. a
 * Handlebars-style body) is a KNOWN DEFERRED case — there is no escape hatch
 * yet, so every {{name}} is treated as a tool-input placeholder. Documented,
 * not solved; revisit if a real config needs literal double braces.
 */
export function unknownPlaceholders(value: string, props: string[]): string[] {
  const missing: string[] = [];
  for (const match of value.matchAll(TEMPLATE_RE)) {
    const name = match[1];
    if (name !== undefined && !props.includes(name) && !missing.includes(name)) {
      missing.push(name);
    }
  }
  return missing;
}
