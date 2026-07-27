import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { supportsPackageEngine } from "../lib/engine-gate.js";
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
  popupStateQuerySchema,
  statusMessageSchema,
  uninstallMessageSchema,
  type PageStatus,
  type PopupInstall,
  type PopupState,
} from "../lib/status.js";
import { localStorageArea } from "../lib/storage.js";
import { INDEX_KEY, indexSchema, type InstallIndex } from "../lib/store-schema.js";

// Page loads resolve against LOCAL storage only (local-lookup.ts); the env-var
// origin is used exclusively by background polls. The install path (step 4)
// fetches from the validated sender origin instead.
const REGISTRY_ORIGIN: string = import.meta.env.WXT_REGISTRY_API_URL ?? "https://webmcp.cafe";

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
        void applyBadge(tabId, status.data.status);
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

    return;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStatus.delete(tabId);
  });
});

async function bootstrap(): Promise<void> {
  await ensureInitialized();
  const existing = await browser.alarms.get(REVOCATIONS_ALARM);
  if (!existing) {
    browser.alarms.create(REVOCATIONS_ALARM, { periodInMinutes: REVOCATION_POLL_MINUTES });
  }
  await pollNow();
}

async function pollNow(): Promise<void> {
  await pollRevocations({
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
    const state =
      revocation !== undefined
        ? "revoked"
        : loaded.status !== "ok"
          ? "broken"
          : !supportsPackageEngine(entry)
            ? "engine-too-old"
            : "ok";
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

  return {
    status,
    hostname,
    schemaState,
    safetyListPresent: revokedDoc !== undefined,
    ...(revokedDoc !== undefined ? { safetyListFetchedAt: revokedDoc.fetchedAt } : {}),
    installs,
    ...(recovery !== undefined ? { recovery } : {}),
  };
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
 * registration worked, nothing otherwise. */
async function applyBadge(tabId: number, status: PageStatus): Promise<void> {
  const attention =
    status.kind === "webmcp-unavailable" ||
    status.kind === "safety-list-missing" ||
    status.kind === "storage-unreadable" ||
    status.kind === "site-blocked";
  const text = attention
    ? "!"
    : status.kind === "registered" && status.toolNames.length > 0
      ? String(status.toolNames.length)
      : "";
  const color = attention ? "#b45309" : "#3f6212";
  try {
    await browser.action.setBadgeText({ tabId, text });
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color });
  } catch {
    // Tab closed or navigated away mid-update; the next pass will re-report.
  }
}
