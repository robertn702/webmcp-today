import { type PopupInstall, type PopupState } from "../../lib/status.js";

// Pure-ish view builders for the popup (vanilla DOM — no React in the
// extension). main.ts wires the data and the uninstall/install callbacks.

export interface ViewCallbacks {
  onUninstall: (packageId: string) => void;
  onInstallSuggestion: (packageId: string, versionId: string) => void;
}

export function popupView(state: PopupState, callbacks: ViewCallbacks): Node[] {
  const nodes: Node[] = [...extensionUpdateNodes(state)];

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
  return nodes;
}

function extensionUpdateNodes(state: PopupState): Node[] {
  if (state.extensionUpdate === undefined) return [];

  const notice = document.createElement("section");
  notice.className = "update-notice";
  notice.append(
    el("h2", "Extension update available"),
    el(
      "p",
      `WebMCP Today ${state.extensionUpdate.version} is available. Unpacked extensions do not update automatically.`,
    ),
  );
  const instructions = document.createElement("a");
  instructions.className = "btn btn-ghost";
  instructions.href = "https://webmcp.today/extension#update-unpacked";
  instructions.target = "_blank";
  instructions.rel = "noreferrer";
  instructions.textContent = "Update instructions";
  notice.append(instructions);
  return [notice];
}

function statusNodes(state: PopupState): Node[] {
  const status = state.status;
  if (!status) {
    return [el("h1", "No status for this tab"), el("p", "Reload the page to check it.")];
  }

  switch (status.kind) {
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
      return [
        el("h1", "Packages paused on this page"),
        el("p", "The extension will retry this page automatically."),
      ];
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
      names.className = "tools";
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
    item.className = "row";

    const line = document.createElement("div");
    line.className = "row-title";
    line.append(el("strong", install.title), ` v${install.version} — ${install.domain}`);
    item.append(line);

    const detail = document.createElement("div");
    detail.className = "row-detail";
    detail.append(stateBadge(install));
    if (install.toolCount !== undefined) detail.append(`· ${install.toolCount} tool(s)`);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost";
    button.textContent = "Uninstall";
    button.addEventListener("click", () => {
      button.disabled = true;
      callbacks.onUninstall(install.packageId);
    });
    detail.append(button);
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
    item.className = "row";

    const line = document.createElement("div");
    line.className = "row-title";
    line.append(el("strong", suggestion.title));
    item.append(line);

    const detail = document.createElement("div");
    detail.className = "row-detail";
    detail.append(suggestion.domain);
    if (suggestion.publicReadOrigins.length > 0) {
      detail.append(
        document.createElement("br"),
        `Also reads from ${suggestion.publicReadOrigins.join(", ")} without cookies.`,
      );
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary";
    button.textContent = "Install";
    button.addEventListener("click", () => {
      button.disabled = true;
      callbacks.onInstallSuggestion(suggestion.packageId, suggestion.versionId);
    });
    detail.append(button);
    item.append(detail);

    list.append(item);
  }
  return [el("h2", "Discover packages"), list];
}

function stateBadge(install: PopupInstall): Node {
  const pill = (classSuffix: string, text: string): HTMLElement => {
    const node = el("span", text);
    node.className = `badge badge-${classSuffix}`;
    return node;
  };
  const fragment = document.createDocumentFragment();
  switch (install.state) {
    case "ok":
      fragment.append(pill("ok", "active"));
      break;
    case "revoked":
      fragment.append(
        pill("revoked", "revoked"),
        ` — pulled by the registry${install.revokedReason ? `: ${install.revokedReason}` : ""}`,
      );
      break;
    case "broken":
      fragment.append(
        pill("broken", "broken"),
        " — stored body unreadable; reinstall from the registry",
      );
      break;
    case "engine-too-old":
      fragment.append(pill("engine-too-old", "outdated"), " — needs a newer extension version");
      break;
  }
  return fragment;
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
