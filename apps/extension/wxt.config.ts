import { resolve } from "node:path";
import { defineConfig } from "wxt";
import { registryMatchPatterns } from "./src/lib/registry-origins.js";

// Dev builds (wxt dev) add `http://localhost/*` (match patterns have no port
// component, so it covers any localhost port); production builds request only
// https://webmcp.today — the store listing must not ask for localhost access.
// WXT sets NODE_ENV before loading this config. registryMatchPatterns() is
// the same function the background's origin allowlist derives from, so the
// manifest and runtime check never drift.
const matchPatterns = registryMatchPatterns(process.env.NODE_ENV !== "production");

export default defineConfig({
  srcDir: "src",
  imports: false,
  // Without this, WXT kebab-cases the package name "@webmcp-today/extension"
  // into "webmcp-todayextension" and the release asset reads as a typo.
  zip: { name: "webmcp-today" },
  dev: {
    // Keep WXT's dev server off port 3000 — that's the registry web app's port.
    // Background polls default to https://webmcp.today; set
    // WXT_REGISTRY_API_URL=http://localhost:3000 to poll a dev registry.
    server: { port: 5173 },
  },
  webExt: {
    // The dev browser is a separate Chrome instance with its own profile, so
    // chrome://flags set in your main profile don't apply. Enable WebMCP via
    // launch args instead (DevToolsWebMCPSupport is needed on Chrome 149).
    chromiumArgs: [
      "--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport",
      // Lets MCP clients (chrome-devtools-mcp via opencode.json at the repo
      // root) attach to this browser and call the page's WebMCP tools.
      "--remote-debugging-port=9222",
    ],
    // Persist the dev profile (default is a fresh temp profile per run) so the
    // Model Context Tool Inspector extension survives restarts — install it
    // once in the dev browser. .wxt/ is gitignored.
    chromiumProfile: resolve(".wxt/chrome-profile"),
    keepProfileChanges: true,
  },
  manifest: {
    name: "WebMCP Today",
    description: "Injects community WebMCP tool configs into sites you visit.",
    // Spread conditionally: an undefined `key` serialized into the manifest
    // is a load error. The key pins the dev extension ID (see AGENTS.md).
    ...(process.env.WXT_EXTENSION_KEY ? { key: process.env.WXT_EXTENSION_KEY } : {}),
    permissions: ["storage", "alarms"],
    // The 128 asset doubles as the Chrome Web Store icon.
    icons: {
      16: "icons/16.png",
      32: "icons/32.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
    // Registry origins the background script fetches configs from. Fixed at
    // build time (manifest permissions can't read the runtime env var).
    host_permissions: [...matchPatterns],
    // Only the registry site may message the extension (the install bridge).
    // Declaring this without "ids" also stops OTHER extensions connecting —
    // intended.
    externally_connectable: { matches: [...matchPatterns] },
  },
});
