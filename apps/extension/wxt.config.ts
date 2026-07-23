import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  manifest: {
    name: "WebMCP Cafe",
    description: "Injects community WebMCP tool configs into sites you visit.",
    // Registry origins the background script fetches configs from. Fixed at
    // build time (manifest permissions can't read the runtime env var), so
    // both the dev default and the production domain are listed.
    host_permissions: ["http://localhost:3000/*", "https://webmcp.cafe/*"],
  },
});
