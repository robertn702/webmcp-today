import { ENGINE_VERSION, type CreatePackageInput } from "@robertn702/webmcp-cafe-schema";
import { executeApiTool } from "./api-executor.js";
import { requiredEngineLevel, supportsPackageEngine } from "./engine-gate.js";
import { executeTool } from "./executor.js";
import type { McpResult, ModelContextLike } from "./model-context.js";
import { WEBMCP_FLAG_URL, type PageStatus } from "./status.js";

type ToolExecute = (params: Record<string, unknown>) => Promise<McpResult>;

/** Seams the content script fills in; tests pass fakes. */
export interface RegistrationDeps {
  /** Packages matching the URL — registry first, bundled fallback. */
  loadPackages: (url: string) => Promise<CreatePackageInput[]>;
  /** Chrome's WebMCP entry point, or undefined when the API is unavailable. */
  getModelContext: () => ModelContextLike | undefined;
  /** Tool names the site declared itself (`form[toolname]`) — ours yield to them. */
  siteDeclaredToolNames: () => Set<string>;
  /** Surfaces the pass outcome on the action badge + popup. */
  reportStatus: (status: PageStatus) => void;
}

/**
 * One registration pass for `url`. Every tool is registered with `signal`, so
 * aborting it (on the next navigation) unregisters everything this pass added.
 *
 * Packages are looked up *before* WebMCP is probed on purpose: a missing
 * `document.modelContext` is only worth telling the user about on a page we
 * actually have tools for — probing first would warn on every page on the
 * internet.
 */
export async function runRegistrationPass(
  url: string,
  signal: AbortSignal,
  deps: RegistrationDeps,
): Promise<void> {
  const packages = await deps.loadPackages(url);
  // Navigated away while the lookup was in flight — the newer pass owns the
  // status, so say nothing.
  if (signal.aborted) return;

  if (packages.length === 0) {
    deps.reportStatus({ kind: "no-packages" });
    return;
  }

  const mc = deps.getModelContext();
  if (!mc) {
    console.warn(
      `[webmcp-cafe] ${packages.length} package(s) match this page, but Chrome's WebMCP API is unavailable, so no tools were registered.\n` +
        `Enable it: open ${WEBMCP_FLAG_URL}, set "WebMCP for testing" to Enabled, then relaunch Chrome. Needs Chrome 149+.`,
    );
    deps.reportStatus({ kind: "webmcp-unavailable", packageCount: packages.length });
    return;
  }

  const declarativeNames = deps.siteDeclaredToolNames();
  const registered: string[] = [];
  const seen = new Set<string>();

  for (const pkg of packages) {
    // Refuse the whole package when it needs an engine newer than this build — a
    // too-new package must not silently register inert/mis-executed tools.
    if (!supportsPackageEngine(pkg)) {
      console.warn(
        `[webmcp-cafe] Skipping package "${pkg.title}" — needs engine level ${requiredEngineLevel(pkg)}, but this extension is level ${ENGINE_VERSION}. Update the extension.`,
      );
      continue;
    }

    for (const tool of pkg.tools) {
      const execution = tool.execution;
      if (!execution) continue;

      // Resolve an execute() for the supported execution modes; skip + warn on
      // anything not yet supported.
      let execute: ToolExecute | undefined;
      if (execution.mode === "dom") {
        execute = (params) => executeTool(tool.name, execution, params, tool.annotations);
      } else if (execution.mode === "api") {
        const api = pkg.api;
        const endpoint = api?.endpoints[execution.endpoint];
        if (!api || !endpoint) {
          console.warn(
            `[webmcp-cafe] Skipping tool "${tool.name}" — api endpoint "${execution.endpoint}" is missing from the package's api block.`,
          );
          continue;
        }
        const endpointName = execution.endpoint;
        execute = (params) =>
          executeApiTool(tool.name, api, endpointName, params, tool.annotations);
      }
      if (!execute) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — execution mode is not supported yet.`,
        );
        continue;
      }

      if (seen.has(tool.name)) continue;
      if (declarativeNames.has(tool.name)) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — collides with a site-declared tool`,
        );
        continue;
      }
      seen.add(tool.name);

      if (signal.aborted) return;
      try {
        // Promise-based in the 2026 draft; rejects on duplicate names, which
        // also covers collisions with imperatively site-registered tools.
        // `signal` ties the tool's lifetime to this pass.
        await mc.registerTool(
          {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
            execute,
          },
          { signal },
        );
        registered.push(tool.name);
        console.info(`[webmcp-cafe] Registered tool "${tool.name}"`);
      } catch (err) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — registerTool rejected (name collision with a site-registered tool?):`,
          err,
        );
      }
    }
  }

  deps.reportStatus({ kind: "registered", toolNames: registered });
}
