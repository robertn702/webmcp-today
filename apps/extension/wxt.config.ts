import { resolve } from "node:path";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  webExt: {
    // The dev browser is a separate Chrome instance with its own profile, so
    // chrome://flags set in your main profile don't apply. Enable WebMCP via
    // launch args instead (DevToolsWebMCPSupport is needed on Chrome 149).
    chromiumArgs: ["--enable-features=WebMCP,DevToolsWebMCPSupport"],
    // Persist the dev profile (default is a fresh temp profile per run) so the
    // Model Context Tool Inspector extension survives restarts — install it
    // once in the dev browser. .wxt/ is gitignored.
    chromiumProfile: resolve(".wxt/chrome-profile"),
    keepProfileChanges: true,
  },
  manifest: {
    name: "WebMCP Cafe",
    description: "Injects community WebMCP tool configs into sites you visit.",
    // Registry origins the background script fetches configs from. Fixed at
    // build time (manifest permissions can't read the runtime env var), so
    // both the dev default and the production domain are listed.
    host_permissions: ["http://localhost:3000/*", "https://webmcp.cafe/*"],
  },
});
