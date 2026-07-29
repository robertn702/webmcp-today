import { resolve } from "node:path";
import { defineConfig } from "wxt";
import { REGISTRY_MATCH_PATTERNS } from "./src/lib/registry-origins.js";

export default defineConfig({
  srcDir: "src",
  imports: false,
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
    // Registry origins the background script fetches configs from. Fixed at
    // build time (manifest permissions can't read the runtime env var), so
    // both the dev default and the production domain are listed. Match
    // patterns have no port component — `http://localhost/*` (not `:3000`)
    // matches any localhost port. REGISTRY_MATCH_PATTERNS is the same
    // constant the background's origin allowlist checks against.
    host_permissions: [...REGISTRY_MATCH_PATTERNS],
    // Only the registry site may message the extension (the install bridge).
    // Declaring this without "ids" also stops OTHER extensions connecting —
    // intended.
    externally_connectable: { matches: [...REGISTRY_MATCH_PATTERNS] },
  },
});
