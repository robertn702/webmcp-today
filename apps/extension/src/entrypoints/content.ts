import { defineContentScript } from "wxt/utils/define-content-script";
import { getConfigsForUrl } from "../lib/configs.js";
import { executeTool } from "../lib/executor.js";
import { getModelContext } from "../lib/model-context.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    void registerTools();
  },
});

async function registerTools(): Promise<void> {
  const mc = getModelContext();
  if (!mc) return;

  const configs = await getConfigsForUrl(window.location.href);
  if (configs.length === 0) return;

  // Site-declared declarative tools — skip ours on name collision.
  const declarativeNames = new Set<string>();
  for (const form of document.querySelectorAll("form[toolname]")) {
    const name = form.getAttribute("toolname");
    if (name) declarativeNames.add(name);
  }

  const seen = new Set<string>();
  for (const config of configs) {
    for (const tool of config.tools) {
      const execution = tool.execution;
      if (!execution) continue;
      if (seen.has(tool.name)) continue;
      if (declarativeNames.has(tool.name)) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — collides with a site-declared tool`,
        );
        continue;
      }
      seen.add(tool.name);

      try {
        // Promise-based in the 2026 draft; rejects on duplicate names, which
        // also covers collisions with imperatively site-registered tools.
        await mc.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
          execute: (params) => executeTool(tool.name, execution, params, tool.annotations),
        });
        console.info(`[webmcp-cafe] Registered tool "${tool.name}"`);
      } catch (err) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — registerTool rejected (name collision with a site-registered tool?):`,
          err,
        );
      }
    }
  }
}
