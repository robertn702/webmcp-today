import { packageLookupResponseSchema, rankPackagesByUrl } from "@webmcp-today/schema";

// Popup discovery suggestions, replacing the old bundled-fallback package
// list: these are real registry packages with ids/versionIds, so a
// suggestion installs through the exact same bridge path (install-bridge.ts)
// as any other install — no synthetic ids that can never be revoked/updated.

export interface Suggestion {
  packageId: string;
  versionId: string;
  version: number;
  title: string;
  domain: string;
}

export interface SuggestionsDeps {
  fetchFn: (url: string) => Promise<Response>;
  origin: string;
  /** Active tab URL. Suggestions are scoped and pattern-filtered by the
   * registry's normal URL lookup path. */
  url: string | undefined;
}

/** `ok: false` means the fetch itself failed (offline, non-2xx, bad body) —
 * kept distinct from `ok: true, packages: []`, which means either no usable
 * tab URL or no registry packages matching a usable URL. */
export type SuggestionsResult = { ok: true; packages: Suggestion[] } | { ok: false };

export async function fetchSuggestions(deps: SuggestionsDeps): Promise<SuggestionsResult> {
  let target: URL;
  try {
    if (deps.url === undefined) return { ok: true, packages: [] };
    target = new URL(deps.url);
  } catch {
    return { ok: true, packages: [] };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: true, packages: [] };
  }
  // URL-pattern matching ignores credentials, ports, search, and fragments; never send them.
  const lookupUrl = `${target.origin}${target.pathname}`;

  let raw: unknown;
  try {
    const params = new URLSearchParams({ url: lookupUrl });
    const response = await deps.fetchFn(`${deps.origin}/api/packages/lookup?${params}`);
    if (!response.ok) return { ok: false };
    raw = await response.json();
  } catch {
    return { ok: false };
  }

  const parsed = packageLookupResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };

  return {
    ok: true,
    packages: rankPackagesByUrl(parsed.data.packages, lookupUrl)
      .slice(0, 6)
      .map((pkg) => ({
        packageId: pkg.id,
        versionId: pkg.versionId,
        version: pkg.version,
        title: pkg.title,
        domain: pkg.domain,
      })),
  };
}
