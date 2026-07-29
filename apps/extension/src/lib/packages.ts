import { requestLocalLookup } from "./lookup-client.js";
import type { PageLoadPackages } from "./local-lookup.js";

// Packages for the current page come from LOCAL storage only — the background
// matches the install index against the URL. The bundled fallback is gone
// from this path; an empty store means every page logs 0 matches and
// registers nothing, which is the expected state, not a failure.

export async function getPackagesForUrl(url: string): Promise<PageLoadPackages> {
  const result = await requestLocalLookup(url);
  if (result === undefined) {
    // Background unreachable or invalid answer — exceptional, but must not be
    // a silent zero: the warn line is the page-console signal.
    console.warn(
      "[webmcp-today] Lookup failed — the extension background did not answer; no tools were registered.",
    );
    return { packages: [] };
  }

  const { packages, diagnostics } = result;
  if (diagnostics.blocked === undefined) {
    console.info(`[webmcp-today] ${packages.length} installed package(s) matched this URL`);
  }
  if (diagnostics.revoked > 0) {
    console.warn(
      `[webmcp-today] ${diagnostics.revoked} matching install(s) suppressed — revoked by the registry (details in the extension popup)`,
    );
  }
  if (diagnostics.broken > 0) {
    console.warn(
      `[webmcp-today] ${diagnostics.broken} matching install(s) skipped — stored package body is missing or unreadable (details in the extension popup)`,
    );
  }

  return {
    packages,
    ...(diagnostics.blocked !== undefined ? { blocked: diagnostics.blocked } : {}),
  };
}
