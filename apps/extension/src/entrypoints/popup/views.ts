import { WEBMCP_FLAG_URL, type PopupInstall, type PopupState } from "../../lib/status.js";

// Pure-ish view builders for the popup (vanilla DOM — no React in the
// extension). main.ts wires the data and the uninstall/install callbacks.

export interface ViewCallbacks {
  onUninstall: (packageId: string) => void;
  onInstallSuggestion: (packageId: string, versionId: string) => void;
}

export function popupView(state: PopupState, callbacks: ViewCallbacks): Node[] {
  const nodes: Node[] = [];

  // Global problem states outrank whatever the page reported.
  if (state.schemaState !== "ok") {
    nodes.push(
      el("h1", "Extension storage is unreadable"),
      el(
        "p",
        state.schemaState === "newer"
          ? "This storage was written by a newer version of the extension. Update the extension; no packages will run until then."
          : "The stored schema marker is corrupt. Reinstalling the extension clears it; installed packages must then be reinstalled from the registry.",
      ),
    );
    return nodes;
  }

  if (state.recovery !== undefined) {
    nodes.push(
      el("h1", "Your installs are gone"),
      el(
        "p",
        state.recovery === "index-corrupt"
          ? "The local install index is unreadable — likely storage corruption. The packages you installed can no longer be matched to pages."
          : "Local storage no longer holds the packages this session had installed — the browser may have evicted the extension's storage.",
      ),
      el("p", "To recover, reinstall the packages you use from the registry."),
    );
    nodes.push(footerNote());
    return nodes;
  }

  if (!state.safetyListPresent) {
    nodes.push(
      el("h1", "Packages paused — waiting on the safety list"),
      el(
        "p",
        "The registry's revocation list hasn't been fetched yet, so installed packages stay paused. This usually means the registry is unreachable; it is retried automatically (and was just retried now).",
      ),
    );
    // Installs still listed below so the pause never reads as data loss.
  } else {
    nodes.push(...statusNodes(state));
  }

  nodes.push(...installsNodes(state, callbacks));
  nodes.push(...suggestionsNodes(state, callbacks));
  nodes.push(footerNote());
  return nodes;
}

function statusNodes(state: PopupState): Node[] {
  const status = state.status;
  if (!status) {
    return [el("h1", "No status for this tab"), el("p", "Reload the page to check it.")];
  }

  switch (status.kind) {
    case "webmcp-unavailable": {
      const steps = document.createElement("ol");
      steps.append(
        li("Open ", code(WEBMCP_FLAG_URL)),
        li('Set "WebMCP for testing" to Enabled'),
        li("Relaunch Chrome, then reload the page"),
      );
      return [
        el("h1", "WebMCP is turned off in Chrome"),
        el(
          "p",
          `${status.packageCount} package(s) match this page, but Chrome exposes no WebMCP API, so no tools were registered.`,
        ),
        steps,
        el("footer", "Needs Chrome 149 or newer."),
      ];
    }
    case "site-blocked":
      return [
        el("h1", "This site blocks WebMCP"),
        el(
          "p",
          `${status.packageCount} installed package(s) match this page, but the site's Permissions-Policy disables WebMCP, so nothing can register here. The packages themselves are fine.`,
        ),
      ];
    case "safety-list-missing":
      // safetyListPresent=false already rendered the pause view; reaching this
      // means the list arrived after the page loaded.
      return [el("h1", "Packages paused on this page"), el("p", "Reload the page to retry.")];
    case "storage-unreadable":
      return [
        el("h1", "Extension storage is unreadable"),
        el("p", "No packages were registered on this page. Try updating the extension."),
      ];
    case "no-packages":
      return [
        el("h1", "No tools for this page"),
        el("p", "None of your installed packages match this URL."),
      ];
    case "registered": {
      if (status.toolNames.length === 0) {
        return [
          el("h1", "No tools registered"),
          el("p", "A package matched but every tool was skipped — see the page console for why."),
        ];
      }
      const names = document.createElement("ul");
      names.append(...status.toolNames.map((name) => li("", code(name))));
      return [el("h1", `${status.toolNames.length} tool(s) registered on this page`), names];
    }
  }
}

function installsNodes(state: PopupState, callbacks: ViewCallbacks): Node[] {
  if (state.installs.length === 0) {
    return [el("p", "No packages installed yet — browse the registry to add some.")];
  }

  const nodes: Node[] = [];
  const onTab = state.installs.filter((install) => install.matchesTab);
  const elsewhere = state.installs.filter((install) => !install.matchesTab);

  if (onTab.length > 0) {
    nodes.push(el("h2", "Installed for this site"));
    nodes.push(installList(onTab, callbacks));
  }
  if (elsewhere.length > 0) {
    nodes.push(el("h2", onTab.length > 0 ? "Other installs" : `Installed (${elsewhere.length})`));
    nodes.push(installList(elsewhere, callbacks));
  }
  return nodes;
}

function installList(installs: PopupInstall[], callbacks: ViewCallbacks): HTMLElement {
  const list = document.createElement("ul");
  list.className = "installs";
  for (const install of installs) {
    const item = document.createElement("li");

    const line = document.createElement("div");
    line.append(el("strong", install.title), ` v${install.version} — ${install.domain}`);
    item.append(line);

    const detail = document.createElement("div");
    detail.append(stateBadge(install));
    if (install.toolCount !== undefined) detail.append(` · ${install.toolCount} tool(s)`);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Uninstall";
    button.addEventListener("click", () => {
      button.disabled = true;
      callbacks.onUninstall(install.packageId);
    });
    detail.append(" · ", button);
    item.append(detail);

    list.append(item);
  }
  return list;
}

/** Registry suggestions — shown only when nothing installed already matches
 * this tab (background only sends `suggestions`/`suggestionsUnavailable` in
 * that case). Distinguishes "couldn't reach the registry" from "the registry
 * genuinely has nothing to suggest right now". */
function suggestionsNodes(state: PopupState, callbacks: ViewCallbacks): Node[] {
  if (state.suggestionsUnavailable) {
    return [
      el("h2", "Discover packages"),
      el("p", "Couldn't reach the registry for suggestions — try again later."),
    ];
  }
  if (state.suggestions === undefined || state.suggestions.length === 0) return [];

  const list = document.createElement("ul");
  list.className = "suggestions";
  for (const suggestion of state.suggestions) {
    const item = document.createElement("li");
    item.append(el("strong", suggestion.title), ` — ${suggestion.domain} `);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Install";
    button.addEventListener("click", () => {
      button.disabled = true;
      callbacks.onInstallSuggestion(suggestion.packageId, suggestion.versionId);
    });
    item.append(button);

    list.append(item);
  }
  return [el("h2", "Discover packages"), list];
}

function stateBadge(install: PopupInstall): HTMLElement {
  switch (install.state) {
    case "ok":
      return el("span", "active");
    case "revoked":
      return el(
        "span",
        `pulled by the registry${install.revokedReason ? `: ${install.revokedReason}` : ""}`,
      );
    case "broken":
      return el("span", "broken — stored body unreadable; reinstall from the registry");
    case "engine-too-old":
      return el("span", "needs a newer extension version");
  }
}

function footerNote(): HTMLElement {
  const footer = document.createElement("footer");
  footer.append("WebMCP needs ", code(WEBMCP_FLAG_URL), " (Chrome 149+).");
  return footer;
}

export function unreachableView(): Node[] {
  return [
    el("h1", "Extension background unavailable"),
    el(
      "p",
      "The popup couldn't reach the extension's background worker. Try reopening the popup or reloading the extension.",
    ),
  ];
}

function el(tag: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function li(text: string, ...children: Node[]): HTMLElement {
  const node = document.createElement("li");
  node.append(text, ...children);
  return node;
}

function code(text: string): HTMLElement {
  return el("code", text);
}
