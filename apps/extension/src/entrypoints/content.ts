import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { getPackagesForUrl } from "../lib/packages.js";
import { getModelContext } from "../lib/model-context.js";
import { startNavigationWatcher } from "../lib/navigation.js";
import { runRegistrationPass, type RegistrationDeps } from "../lib/register-tools.js";
import { STATUS_MESSAGE_TYPE, type PageStatus } from "../lib/status.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // Runs the first pass now and re-runs it on SPA route changes.
    startNavigationWatcher({
      getUrl: () => window.location.href,
      run: (url, signal) => runRegistrationPass(url, signal, deps),
    });
  },
});

const deps: RegistrationDeps = {
  loadPackages: getPackagesForUrl,
  getModelContext,
  siteDeclaredToolNames,
  reportStatus,
};

/** Tools the site declared itself — ours skip on a name collision. */
function siteDeclaredToolNames(): Set<string> {
  const names = new Set<string>();
  for (const form of document.querySelectorAll("form[toolname]")) {
    const name = form.getAttribute("toolname");
    if (name) names.add(name);
  }
  return names;
}

/** Fire-and-forget: nothing here should fail a registration pass. */
function reportStatus(status: PageStatus): void {
  void browser.runtime
    .sendMessage({ type: STATUS_MESSAGE_TYPE, status, hostname: window.location.hostname })
    .catch(() => {});
}
