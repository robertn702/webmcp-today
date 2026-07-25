import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { getConfigsForUrl } from "../lib/configs.js";
import { getModelContext } from "../lib/model-context.js";
import { runRegistrationPass, type RegistrationDeps } from "../lib/register-tools.js";
import { STATUS_MESSAGE_TYPE, type PageStatus } from "../lib/status.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    void runRegistrationPass(window.location.href, deps);
  },
});

const deps: RegistrationDeps = {
  loadConfigs: getConfigsForUrl,
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
  void browser.runtime.sendMessage({ type: STATUS_MESSAGE_TYPE, status }).catch(() => {});
}
