import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  manifest: {
    name: "WebMCP Cafe",
    description: "Injects community WebMCP tool configs into sites you visit.",
  },
});
