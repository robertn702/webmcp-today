import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Next owns bundling for this app; the only reason this config exists is to
// teach vitest the `@/*` tsconfig path alias so route handlers can be imported
// in tests. Other packages need no config and have none.
export default defineConfig({
  resolve: {
    alias: { "@": dirname(fileURLToPath(import.meta.url)) },
  },
});
