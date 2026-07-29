// The closed set of registry origins allowed to drive installs over the
// external-message bridge. wxt.config.ts builds host_permissions and
// externally_connectable.matches from registryMatchPatterns(), so the manifest
// and this runtime check can never drift apart.
//
// Dev builds (wxt dev, tests) also trust a localhost registry; production
// builds (wxt build / wxt zip) trust only https://webmcp.today — the store
// listing must not request localhost host access.
export function registryMatchPatterns(dev: boolean): readonly string[] {
  return dev ? ["https://webmcp.today/*", "http://localhost/*"] : ["https://webmcp.today/*"];
}

/** Whether a message sender's origin is one of the registry origins. */
export function isAllowedRegistryOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === "https:" && url.hostname === "webmcp.today") return true;
  // Match patterns have no port component — http://localhost/* covers any
  // localhost port, so the runtime check does too. Dev builds only: Vite
  // statically replaces import.meta.env.DEV, so production bundles drop this
  // branch to match the production manifest. (Read inside the function —
  // wxt.config.ts imports this module in Node, where import.meta.env is
  // undefined.)
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- Vite build-time constant, not a process env var
  return import.meta.env.DEV && url.protocol === "http:" && url.hostname === "localhost";
}
