import type { ApiBlock } from "./api.js";

// A stable content identifier for an api block. The same logical surface is
// duplicated across a package's versions and across rival packages targeting
// the same site, and `documents` entries run to 100 KB — so clients key stored
// copies on this hash (docs/local-first-installs.md §1).
//
// The canonical form below is therefore a FROZEN COMPATIBILITY SURFACE: any
// change to it invalidates every copy a client already has. It is derived from
// the value alone — never from Postgres jsonb text, and never from incidental
// JSON.stringify key order.

/** Compare by UTF-16 code unit. Deliberately not localeCompare, whose ordering
 * depends on the runtime's ICU data and so differs between consumers. */
function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) {
    // JSON.stringify would silently emit `null` for these and collide with a
    // real null. A surface containing one is not representable — say so.
    throw new Error(`Cannot canonicalize non-finite number: ${String(value)}`);
  }
  // String() is ECMAScript's shortest round-tripping representation, so 1.0
  // and 1 agree. -0 is folded to 0: a JSON round-trip loses the sign anyway,
  // and the two must not hash differently.
  return value === 0 ? "0" : String(value);
}

function canonicalValue(value: unknown): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return canonicalNumber(value);
    case "boolean":
      return value ? "true" : "false";
    case "object": {
      if (value === null) return "null";
      if (Array.isArray(value)) {
        // Array order is meaningful in this data (endpoint.auth is an ordered
        // list of token fetches), so it is preserved, never sorted. A hole or
        // an explicit undefined becomes null, matching JSON.stringify.
        const items = value.map((item: unknown) =>
          item === undefined ? "null" : canonicalValue(item),
        );
        return `[${items.join(",")}]`;
      }
      // Recursive key sort. Keys whose value is undefined are dropped so that
      // an absent optional field and one explicitly set to undefined — the
      // same block before and after a JSON round-trip — canonicalize alike.
      const entries = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => compareKeys(a, b))
        .map(([key, v]) => `${JSON.stringify(key)}:${canonicalValue(v)}`);
      return `{${entries.join(",")}}`;
    }
    default:
      throw new Error(`Cannot canonicalize value of type ${typeof value}`);
  }
}

/**
 * Canonical string form of an api block: object keys sorted recursively, array
 * order preserved, numbers in a stable representation. Storage-independent and
 * consumer-independent — two logically identical blocks always agree.
 */
export function canonicalizeApiBlock(api: ApiBlock): string {
  return canonicalValue(api);
}

/**
 * Lowercase-hex sha256 of {@link canonicalizeApiBlock}.
 *
 * Async because it uses Web Crypto rather than node:crypto: the extension
 * bundles this package for the browser, and rollup hard-fails on `node:crypto`
 * ("createHash is not exported by __vite-browser-external"). crypto.subtle is
 * available in browsers, extension service workers and Node 16+.
 */
export async function apiContentHash(api: ApiBlock): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeApiBlock(api));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
