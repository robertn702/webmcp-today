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

// Public development identity for unpacked local builds. Its matching private
// key is stored in 1Password; releases override this through WXT_EXTENSION_KEY.
const developmentExtensionKey =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAl0DK8WOYNqdmxaOeksFExZilyd5HTPAFFZnFtvWYp1+HT80DXp46R8+g/nPpKsj1lnv6+5wScPn+b7PapJwFPJd1SfLstrmgJCySHskBdYsr4tERzdsnj41YBVIT+TkFV+Y3rKd8PLVN0CI3vxhla6SEFW4ccy9Qw8eedhtUwLH+pmeWYihm47VQ4C1+fnSJA1KvcxcgQ4ACqEs9/yXSeGpCbpRgROrJR3CrlqVwW78Xwr9NhOBkjNPJIN0RV9MAaLG7iWI+wT/oyaDjJz9HaLEOUdgFA4h/29UO0++2zw1oi4daujyEP02JBpS6/Rpc+oB3qlxCBa/pDAMUTDPcsQIDAQAB";
const extensionKey = process.env.WXT_EXTENSION_KEY ?? developmentExtensionKey;

export default defineConfig({
  srcDir: "src",
  imports: false,
  // Without this, WXT kebab-cases the package name "@webmcp-today/extension"
  // into "webmcp-todayextension" and the release asset reads as a typo.
  zip: { name: "webmcp-today-extension" },
  dev: {
    // Keep WXT's dev server off port 3000 — that's the registry web app's port.
    // Background polls default to https://webmcp.today; set
    // WXT_REGISTRY_API_URL=http://localhost:3000 to poll a dev registry.
    server: { port: 5173 },
  },
  webExt: {
    // The dev browser is a separate Chrome instance with its own profile, so
    // chrome://flags set in your main profile don't apply. The local bridge
    // calls WebMCP from the content script; it needs no DevTools or remote port.
    chromiumArgs: ["--enable-features=WebMCP,WebMCPTesting"],
    // Persist the dev profile (default is a fresh temp profile per run) so the
    // Model Context Tool Inspector extension survives restarts — install it
    // once in the dev browser. .wxt/ is gitignored.
    chromiumProfile: resolve(".wxt/chrome-profile"),
    keepProfileChanges: true,
  },
  manifest: {
    name: "WebMCP Today",
    description: "Injects community WebMCP tool configs into sites you visit.",
    // A public key pins local builds to one development extension ID. Release
    // CI supplies WXT_EXTENSION_KEY to use its distinct release identity.
    key: extensionKey,
    permissions: ["storage", "alarms", "nativeMessaging"],
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
