import { z } from "zod";
import type { StorageArea } from "./store-schema.js";

const chromeVersionPart = "(?:0|[1-9][0-9]{0,4})";
const chromeVersionPattern = new RegExp(`^${chromeVersionPart}(?:\\.${chromeVersionPart}){0,3}$`);

export const EXTENSION_UPDATE_KEY = "extensionUpdate";
export const EXTENSION_UPDATE_ALARM = "extension-update";
export const EXTENSION_UPDATE_POLL_MINUTES = 1440;
export const EXTENSION_UPDATE_STALE_MS = 24 * 60 * 60 * 1000;
export const SELF_HOSTED_RELEASE_ID = "kngdblibgfakdkfgbbolnmgajaacchgb";

const latestExtensionSchema = z.object({
  channel: z.literal("stable"),
  version: z.string().regex(chromeVersionPattern),
  releaseUrl: z.url(),
  downloadUrl: z.url(),
  checksumsUrl: z.url(),
  publishedAt: z.iso.datetime(),
});

const extensionUpdateStateSchema = z.object({
  checkedAt: z.iso.datetime(),
  latest: latestExtensionSchema,
});

export type ExtensionUpdateState = z.infer<typeof extensionUpdateStateSchema>;

export type ExtensionInstall = { id: string; installType: string };

type ChromeVersion = number[];

let inFlightPoll: Promise<ExtensionUpdateState | undefined> | undefined;

export function parseChromeVersion(version: string): ChromeVersion | undefined {
  if (!chromeVersionPattern.test(version)) return undefined;
  const parts = version.split(".").map(Number);
  return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 65_535)
    ? parts
    : undefined;
}

export function compareChromeVersions(left: string, right: string): number | undefined {
  const leftParts = parseChromeVersion(left);
  const rightParts = parseChromeVersion(right);
  if (leftParts === undefined || rightParts === undefined) return undefined;

  for (let index = 0; index < 4; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export async function readExtensionUpdateState(
  area: StorageArea,
): Promise<ExtensionUpdateState | undefined> {
  const raw = (await area.get(EXTENSION_UPDATE_KEY))[EXTENSION_UPDATE_KEY];
  const parsed = extensionUpdateStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function isExtensionUpdateStateFresh(state: ExtensionUpdateState, now: Date): boolean {
  const checkedAt = Date.parse(state.checkedAt);
  if (!Number.isFinite(checkedAt)) return false;
  const age = now.getTime() - checkedAt;
  return age >= 0 && age < EXTENSION_UPDATE_STALE_MS;
}

export function shouldShowExtensionUpdate(
  state: ExtensionUpdateState | undefined,
  installedVersion: string,
  install: ExtensionInstall | undefined,
): boolean {
  if (
    state === undefined ||
    install?.installType !== "development" ||
    install.id !== SELF_HOSTED_RELEASE_ID
  ) {
    return false;
  }
  const comparison = compareChromeVersions(state.latest.version, installedVersion);
  return comparison !== undefined && comparison > 0;
}

export interface ExtensionUpdatePollDeps {
  area: StorageArea;
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>;
  origin: string;
  getInstall: () => Promise<ExtensionInstall>;
  now?: () => Date;
}

/**
 * Refreshes release metadata at most once a day. The promise is only a
 * worker-lifetime dedupe mechanism; the useful result lives in local storage.
 */
export function pollExtensionUpdate(
  deps: ExtensionUpdatePollDeps,
): Promise<ExtensionUpdateState | undefined> {
  if (inFlightPoll !== undefined) return inFlightPoll;

  // A storage failure must be just as optional as a network failure. Convert it
  // here because alarms and popup opens intentionally fire this without await.
  const polling = pollExtensionUpdateOnce(deps).catch(() => undefined);
  inFlightPoll = polling;
  void polling.then(() => {
    if (inFlightPoll === polling) inFlightPoll = undefined;
  });
  return polling;
}

async function pollExtensionUpdateOnce(
  deps: ExtensionUpdatePollDeps,
): Promise<ExtensionUpdateState | undefined> {
  const now = deps.now?.() ?? new Date();
  const existing = await readExtensionUpdateState(deps.area);
  if (existing !== undefined && isExtensionUpdateStateFresh(existing, now)) return existing;

  let install: ExtensionInstall;
  try {
    install = await deps.getInstall();
  } catch {
    return existing;
  }
  if (install.installType !== "development" || install.id !== SELF_HOSTED_RELEASE_ID)
    return existing;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await deps.fetchFn(`${deps.origin}/api/extension/latest`, {
      signal: controller.signal,
    });
    if (!response.ok) return existing;
    const parsed = latestExtensionSchema.safeParse(await response.json());
    if (!parsed.success) return existing;

    const state: ExtensionUpdateState = { checkedAt: now.toISOString(), latest: parsed.data };
    await deps.area.set({ [EXTENSION_UPDATE_KEY]: state });
    return state;
  } catch {
    return existing;
  } finally {
    clearTimeout(timeout);
  }
}
