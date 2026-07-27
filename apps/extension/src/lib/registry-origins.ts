// The closed set of registry origins allowed to drive installs over the
// external-message bridge. wxt.config.ts builds host_permissions and
// externally_connectable.matches from REGISTRY_MATCH_PATTERNS, so the manifest
// and this runtime check can never drift apart.
export const REGISTRY_MATCH_PATTERNS = ["https://webmcp.cafe/*", "http://localhost/*"] as const;

/** Whether a message sender's origin is one of the registry origins. */
export function isAllowedRegistryOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === "https:" && url.hostname === "webmcp.cafe") return true;
  // Match patterns have no port component — http://localhost/* covers any
  // localhost port, so the runtime check does too.
  return url.protocol === "http:" && url.hostname === "localhost";
}
