import { BRIDGE_PROTOCOL_VERSION } from "@robertn702/webmcp-today-schema";
import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import {
  DOMAINS_ALARM,
  DOMAINS_POLL_MINUTES,
  isDomainAvailable,
  pollDomains,
  readDomainsDoc,
} from "../lib/domains.js";
import { handleBridgeRequest, installPackage, resolveInstallState } from "../lib/install-bridge.js";
import { createInstallsStore, type SchemaVersionState } from "../lib/installs-store.js";
import { resolveLocalLookup, type LocalLookupResult } from "../lib/local-lookup.js";
import { lookupMessageSchema } from "../lib/lookup-client.js";
import { findRevocation, matchInstalled } from "../lib/match-installed.js";
import {
  REVOCATIONS_ALARM,
  REVOCATION_POLL_MINUTES,
  pollRevocations,
  readRevokedDoc,
} from "../lib/revocations.js";
import {
  installSuggestionMessageSchema,
  popupStateQuerySchema,
  statusMessageSchema,
  uninstallMessageSchema,
  type PageStatus,
  type PopupInstall,
  type PopupState,
} from "../lib/status.js";
import { localStorageArea } from "../lib/storage.js";
import { fetchSuggestions } from "../lib/suggestions.js";
import { INDEX_KEY, indexSchema, type InstallIndex } from "../lib/store-schema.js";

// Page loads resolve against LOCAL storage only (local-lookup.ts); the env-var
// origin is used exclusively by background polls. The install path (step 4)
// fetches from the validated sender origin instead.
const REGISTRY_ORIGIN: string = import.meta.env.WXT_REGISTRY_API_URL ?? "https://webmcp.today";

const store = createInstallsStore(localStorageArea);

/** Last reported status per tab, for the popup. In-memory on purpose: a service
 * worker restart loses it and the popup then says "reload the page", while the
 * badge (per-tab browser state) survives independently. */
const tabStatus = new Map<number, PageStatus>();

/** Highest install count this worker has observed — the "some other signal"
 * behind the popup's installs-vanished recovery state. Worker-lifetime only:
 * eviction while the worker is dead is undetectable in v1 (accepted). */
let lastKnownInstallCount = 0;

/** Memoized so every wake path (message, alarm, startup) gates on the same
 * initialize() before anything is served — readIndex/loadPackage do not
 * consult the schemaVersion guard themselves. */
let initPromise: Promise<SchemaVersionState> | undefined;
function ensureInitialized(): Promise<SchemaVersionState> {
  initPromise ??= store.initialize();
  return initPromise;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void bootstrap();
  });
  browser.runtime.onStartup.addListener(() => {
    void bootstrap();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REVOCATIONS_ALARM) void pollNow();
    if (alarm.name === DOMAINS_ALARM) void pollDomainsNow();
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || changes[INDEX_KEY] === undefined) return;
    const parsed = indexSchema.safeParse(changes[INDEX_KEY].newValue);
    if (parsed.success) rememberInstallCount(parsed.data);
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const lookup = lookupMessageSchema.safeParse(message);
    if (lookup.success) {
      void handleLookup(lookup.data.url).then(sendResponse);
      return true;
    }

    const status = statusMessageSchema.safeParse(message);
    if (status.success) {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        tabStatus.set(tabId, status.data.status);
        void applyBadge(tabId, status.data.status, status.data.hostname);
      }
      return;
    }

    if (popupStateQuerySchema.safeParse(message).success) {
      void buildPopupState().then(sendResponse);
      return true;
    }

    const uninstall = uninstallMessageSchema.safeParse(message);
    if (uninstall.success) {
      void handleUninstall(uninstall.data.packageId).then(sendResponse);
      return true;
    }

    const installSuggestion = installSuggestionMessageSchema.safeParse(message);
    if (installSuggestion.success) {
      void handleInstallSuggestion(installSuggestion.data).then(sendResponse);
      return true;
    }

    return;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStatus.delete(tabId);
  });

  // The registry site's install bridge. Separate from onMessage: this is the
  // only listener external pages can reach (externally_connectable), and
  // handleBridgeRequest re-validates the sender origin + message regardless.
  browser.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
    void handleBridgeRequest(message, sender.origin, {
      store,
      area: localStorageArea,
      fetchFn: (url) => fetch(url),
      extensionVersion: browser.runtime.getManifest().version,
      ensureInitialized,
    }).then(sendResponse);
    return true;
  });
});

async function bootstrap(): Promise<void> {
  await ensureInitialized();
  const existing = await browser.alarms.get(REVOCATIONS_ALARM);
  if (!existing) {
    browser.alarms.create(REVOCATIONS_ALARM, { periodInMinutes: REVOCATION_POLL_MINUTES });
  }
  const existingDomains = await browser.alarms.get(DOMAINS_ALARM);
  if (!existingDomains) {
    browser.alarms.create(DOMAINS_ALARM, { periodInMinutes: DOMAINS_POLL_MINUTES });
  }
  await Promise.all([pollNow(), pollDomainsNow()]);
}

async function pollNow(): Promise<void> {
  await pollRevocations({
    area: localStorageArea,
    fetchFn: (url) => fetch(url),
    origin: REGISTRY_ORIGIN,
  });
}

async function pollDomainsNow(): Promise<void> {
  await pollDomains({
    area: localStorageArea,
    fetchFn: (url) => fetch(url),
    origin: REGISTRY_ORIGIN,
  });
}

function rememberInstallCount(index: InstallIndex): void {
  const count = Object.keys(index).length;
  if (count > 0) lastKnownInstallCount = count;
}

async function handleLookup(url: string): Promise<LocalLookupResult> {
  const schemaState = await ensureInitialized();
  if (schemaState !== "ok") {
    return {
      packages: [],
      diagnostics: { matched: 0, revoked: 0, broken: 0, blocked: "storage-unreadable" },
    };
  }
  const result = await resolveLocalLookup(url, store, localStorageArea);
  rememberInstallCount(await store.readIndex());
  return result;
}

async function buildPopupState(): Promise<PopupState> {
  const schemaState = await ensureInitialized();

  const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  const status = (tab?.id === undefined ? undefined : tabStatus.get(tab.id)) ?? null;
  let hostname: string | null = null;
  try {
    hostname = tab?.url ? new URL(tab.url).hostname : null;
  } catch {
    hostname = null;
  }

  const revokedDoc = await readRevokedDoc(localStorageArea);
  // Popup open is a natural retry moment for the fail-closed state.
  if (revokedDoc === undefined) void pollNow();

  const rawIndex = (await localStorageArea.get(INDEX_KEY))[INDEX_KEY];
  const parsedIndex = rawIndex === undefined ? undefined : indexSchema.safeParse(rawIndex);
  const index: InstallIndex = parsedIndex?.success ? parsedIndex.data : {};
  const count = Object.keys(index).length;

  let recovery: PopupState["recovery"];
  if (parsedIndex !== undefined && !parsedIndex.success) recovery = "index-corrupt";
  else if (count === 0 && lastKnownInstallCount > 0) recovery = "installs-vanished";
  rememberInstallCount(index);

  const matchedIds = new Set(
    tab?.url ? matchInstalled(index, tab.url).map((entry) => entry.packageId) : [],
  );

  const installs: PopupInstall[] = [];
  for (const entry of Object.values(index)) {
    const revocation =
      revokedDoc === undefined ? undefined : findRevocation(revokedDoc.entries, entry);
    const loaded = await store.loadPackage(entry.packageId);
    const state = resolveInstallState(entry, revocation, loaded);
    installs.push({
      packageId: entry.packageId,
      title: entry.title,
      version: entry.version,
      domain: entry.domain,
      state,
      ...(revocation !== undefined ? { revokedReason: revocation.reason } : {}),
      ...(loaded.status === "ok" ? { toolCount: loaded.body.tools.length } : {}),
      matchesTab: matchedIds.has(entry.packageId),
    });
  }
  installs.sort((a, b) => Number(b.matchesTab) - Number(a.matchesTab));

  // Discovery suggestions replace the old bundled fallback: only fetched (and
  // only ever shown) once nothing installed already covers this tab.
  let suggestions: PopupState["suggestions"];
  let suggestionsUnavailable: PopupState["suggestionsUnavailable"];
  if (matchedIds.size === 0) {
    const result = await fetchSuggestions({
      fetchFn: (url) => fetch(url),
      origin: REGISTRY_ORIGIN,
    });
    if (result.ok) suggestions = result.packages;
    else suggestionsUnavailable = true;
  }

  return {
    status,
    hostname,
    schemaState,
    safetyListPresent: revokedDoc !== undefined,
    ...(revokedDoc !== undefined ? { safetyListFetchedAt: revokedDoc.fetchedAt } : {}),
    installs,
    ...(recovery !== undefined ? { recovery } : {}),
    ...(suggestions !== undefined ? { suggestions } : {}),
    ...(suggestionsUnavailable !== undefined ? { suggestionsUnavailable } : {}),
  };
}

async function handleInstallSuggestion(request: { packageId: string; versionId: string }) {
  return installPackage(
    {
      v: BRIDGE_PROTOCOL_VERSION,
      type: "install",
      packageId: request.packageId,
      versionId: request.versionId,
    },
    REGISTRY_ORIGIN,
    {
      store,
      area: localStorageArea,
      fetchFn: (url) => fetch(url),
      extensionVersion: browser.runtime.getManifest().version,
      ensureInitialized,
    },
    "suggested",
  );
}

async function handleUninstall(packageId: string): Promise<{ removed: boolean }> {
  await ensureInitialized();
  let threw = false;
  try {
    await store.uninstall(packageId);
  } catch {
    threw = true;
  }
  // A thrown uninstall may still have committed its index removal — re-read
  // instead of assuming failure, and reclaim the possibly-orphaned body.
  const index = await store.readIndex();
  const removed = index[packageId] === undefined;
  if (threw && removed) void store.collectOrphans().catch(() => undefined);
  return { removed };
}

/** "!" for every state that needs the user's attention (flag off, safety list
 * missing, storage unreadable, site blocks WebMCP), the tool count when
 * registration worked, a "•" discovery hint when nothing is installed here
 * but the registry has packages for this domain, nothing otherwise. */
async function applyBadge(tabId: number, status: PageStatus, hostname: string): Promise<void> {
  const attention =
    status.kind === "webmcp-unavailable" ||
    status.kind === "safety-list-missing" ||
    status.kind === "storage-unreadable" ||
    status.kind === "site-blocked";

  let text: string;
  let color: string;
  if (attention) {
    text = "!";
    color = "#b45309";
  } else if (status.kind === "registered" && status.toolNames.length > 0) {
    text = String(status.toolNames.length);
    color = "#3f6212";
  } else if (
    status.kind === "no-packages" &&
    isDomainAvailable(await readDomainsDoc(localStorageArea), hostname)
  ) {
    text = "\u2022";
    color = "#1d4ed8";
  } else {
    text = "";
    color = "#3f6212";
  }

  try {
    await browser.action.setBadgeText({ tabId, text });
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color });
  } catch {
    // Tab closed or navigated away mid-update; the next pass will re-report.
  }
}
