import { packageListResponseSchema } from "@robertn702/webmcp-today-schema";

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
}

/** `ok: false` means the fetch itself failed (offline, non-2xx, bad body) —
 * kept distinct from `ok: true, packages: []`, which means the registry was
 * reached and genuinely has nothing to suggest. */
export type SuggestionsResult = { ok: true; packages: Suggestion[] } | { ok: false };

export async function fetchSuggestions(deps: SuggestionsDeps): Promise<SuggestionsResult> {
  let raw: unknown;
  try {
    const response = await deps.fetchFn(`${deps.origin}/api/packages?pageSize=6`);
    if (!response.ok) return { ok: false };
    raw = await response.json();
  } catch {
    return { ok: false };
  }

  const parsed = packageListResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };

  return {
    ok: true,
    packages: parsed.data.packages.map((pkg) => ({
      packageId: pkg.id,
      versionId: pkg.versionId,
      version: pkg.version,
      title: pkg.title,
      domain: pkg.domain,
    })),
  };
}
