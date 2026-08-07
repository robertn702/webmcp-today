import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createNativeHostInstallerDeps,
  developmentExtensionId,
  getBridgeStatus,
  installBridge,
  uninstallBridge,
  type Browser,
  type NativeHostInstallerDeps,
} from "./native-host-installer.js";
import { jsonResult } from "./result.js";

interface SetupInstaller {
  install(
    deps: NativeHostInstallerDeps,
    options: { browser: Browser; extensionId?: string },
  ): ReturnType<typeof installBridge>;
  status(
    deps: NativeHostInstallerDeps,
    options: { browser: Browser },
  ): ReturnType<typeof getBridgeStatus>;
  uninstall(
    deps: NativeHostInstallerDeps,
    options: { browser: Browser },
  ): ReturnType<typeof uninstallBridge>;
}

const installer: SetupInstaller = {
  install: installBridge,
  status: getBridgeStatus,
  uninstall: uninstallBridge,
};

/**
 * Advertised as a plain boolean (no `const`) because some MCP clients degrade
 * `const: true` to the string "true" in tool calls; the preprocess accepts that
 * form, and the handlers still gate on the parsed value being exactly true.
 */
export const confirmApproval = (action: string) =>
  z
    .preprocess((value) => (value === "true" ? true : value), z.boolean().optional())
    .describe(`Must be true to approve ${action}.`);

export function createSetupToolHandlers(
  deps: NativeHostInstallerDeps,
  operations: SetupInstaller = installer,
) {
  return {
    setup: async ({
      browser,
      confirm,
      extensionId,
    }: {
      browser: Browser;
      confirm?: boolean;
      extensionId?: string;
    }) => {
      if (confirm !== true) return confirmationRequired("setup_webmcp_bridge");
      return run(() => operations.install(deps, { browser, extensionId }));
    },
    status: async ({ browser }: { browser: Browser }) =>
      run(() => operations.status(deps, { browser })),
    uninstall: async ({ browser, confirm }: { browser: Browser; confirm?: boolean }) => {
      if (confirm !== true) return confirmationRequired("uninstall_webmcp_bridge");
      return run(() => operations.uninstall(deps, { browser }));
    },
  };
}

export function registerSetupTools(
  server: McpServer,
  deps: NativeHostInstallerDeps = createNativeHostInstallerDeps(),
): void {
  const handlers = createSetupToolHandlers(deps);
  const browser = z.enum(["chrome", "brave"]).default("chrome");

  server.registerTool(
    "setup_webmcp_bridge",
    {
      description:
        "Install the first-party WebMCP Today native bridge for macOS Chrome or Brave. This copies a fixed bundled host to ~/.config/webmcp-today and writes only this bridge's native-messaging manifest under ~/Library/Application Support. Set confirm to true to approve these writes.",
      inputSchema: {
        browser,
        confirm: confirmApproval("the bridge installation"),
        extensionId: z
          .literal(developmentExtensionId)
          .optional()
          .describe(
            "Development-only override. Public setup otherwise uses the official release ID.",
          ),
      },
    },
    handlers.setup,
  );

  server.registerTool(
    "get_webmcp_bridge_status",
    {
      description:
        "Inspect the macOS Chrome or Brave WebMCP Today bridge installation without changing files. Reports bridge-owned paths and permissions but never returns the bridge secret.",
      inputSchema: { browser },
    },
    handlers.status,
  );

  server.registerTool(
    "uninstall_webmcp_bridge",
    {
      description:
        "Remove WebMCP Today's macOS native-messaging bridge artifacts for Chrome or Brave. Brave retains Chrome's compatibility manifest because Brave may use it; the result reports that residual and the required follow-up Chrome uninstall. Set confirm to true to approve removal.",
      inputSchema: {
        browser,
        confirm: confirmApproval("bridge removal"),
      },
    },
    handlers.uninstall,
  );
}

function confirmationRequired(tool: string) {
  return jsonResult({
    installed: false,
    message: `Call ${tool} again with confirm: true to approve this WebMCP Today bridge filesystem change.`,
  });
}

async function run(operation: () => Promise<unknown>) {
  try {
    return jsonResult(await operation());
  } catch (error) {
    return {
      ...jsonResult({ message: errorMessage(error) }),
      isError: true,
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The WebMCP Today bridge operation failed.";
}
