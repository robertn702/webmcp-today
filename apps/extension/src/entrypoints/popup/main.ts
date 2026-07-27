import {
  bridgeInstallResponseSchema,
  type BridgeInstallResponse,
} from "@robertn702/webmcp-cafe-schema";
import { browser } from "wxt/browser";
import {
  INSTALL_SUGGESTION_MESSAGE_TYPE,
  POPUP_STATE_QUERY_TYPE,
  UNINSTALL_MESSAGE_TYPE,
  popupStateSchema,
  type PopupState,
} from "../../lib/status.js";
import { popupView, unreachableView } from "./views.js";

// Per-tab status + the local install list, from the background's popup-state
// message. Deliberately not injected into the page — banners on third-party
// sites are user-hostile and a review risk.

const root = document.getElementById("status");
if (root) void render(root);

async function render(root: HTMLElement): Promise<void> {
  const state = await queryState();
  if (state === undefined) {
    root.replaceChildren(...unreachableView());
    return;
  }
  root.replaceChildren(
    ...popupView(state, {
      onUninstall: (packageId) => void uninstallAndRerender(root, packageId),
      onInstallSuggestion: (packageId, versionId) =>
        installSuggestionAndRerender(root, packageId, versionId),
    }),
  );
}

async function queryState(): Promise<PopupState | undefined> {
  let response: unknown;
  try {
    response = await browser.runtime.sendMessage({ type: POPUP_STATE_QUERY_TYPE });
  } catch {
    return undefined;
  }
  const parsed = popupStateSchema.safeParse(response);
  return parsed.success ? parsed.data : undefined;
}

/** A thrown/failed uninstall may still have committed — never assume failure;
 * re-query the background (which re-reads the index) and re-render from that. */
async function uninstallAndRerender(root: HTMLElement, packageId: string): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: UNINSTALL_MESSAGE_TYPE, packageId });
  } catch {
    // Fall through to the re-render: the fresh state is the truth.
  }
  await render(root);
}

/** Installs a suggested package through the same background install-bridge
 * path as a page-driven install, then re-renders (a success moves it from
 * suggestions into the install list; a failure just leaves it suggested). */
async function installSuggestionAndRerender(
  root: HTMLElement,
  packageId: string,
  versionId: string,
): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage({
      type: INSTALL_SUGGESTION_MESSAGE_TYPE,
      packageId,
      versionId,
    });
    const parsed = bridgeInstallResponseSchema.safeParse(response);
    if (parsed.success) reportInstallResult(parsed.data);
  } catch {
    // Fall through to the re-render: the fresh state is the truth.
  }
  await render(root);
}

function reportInstallResult(result: BridgeInstallResponse): void {
  if (!result.ok) console.warn(`[webmcp-cafe] Suggestion install failed: ${result.reason}`);
}
