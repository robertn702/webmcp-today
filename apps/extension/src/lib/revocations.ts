import { revocationsResponseSchema, type RevocationsResponse } from "@webmcp-today/schema";
import {
  REVOKED_KEY,
  revokedDocSchema,
  type RevokedDoc,
  type StorageArea,
} from "./store-schema.js";

// Revocation feed client. The stored doc's ABSENCE is the fail-closed gate:
// until one poll has succeeded, nothing registers (local-lookup.ts). A failed
// poll never touches the stored doc, so a working kill list survives outages.

export const REVOCATIONS_ALARM = "revocations";
/** 6-hour tick per docs/local-first-installs.md §revocations. */
export const REVOCATION_POLL_MINUTES = 360;

export async function readRevokedDoc(area: StorageArea): Promise<RevokedDoc | undefined> {
  const raw = (await area.get(REVOKED_KEY))[REVOKED_KEY];
  if (raw === undefined) return undefined;
  const parsed = revokedDocSchema.safeParse(raw);
  // A corrupt doc reads as absent: same fail-closed posture as never-fetched.
  return parsed.success ? parsed.data : undefined;
}

export interface PollDeps {
  area: StorageArea;
  fetchFn: (url: string) => Promise<Response>;
  /** Registry origin — build-time env for polls (never derived from a page). */
  origin: string;
  now?: () => Date;
}

export type PollResult = { ok: true; doc: RevokedDoc; reset: boolean } | { ok: false };

/**
 * Fetch `GET /api/revocations?since=<cursor>` and advance the stored doc.
 *
 * Self-healing cursor (risk R3): a pre-launch DB wipe restarts the bigserial,
 * so a stored cursor can be AHEAD of the server's `latest` — such a client
 * would otherwise never see another revocation. When `stored > latest`, reset
 * to 0 and refetch the whole feed; the fresh feed replaces the old entries,
 * which referenced ids from the wiped world.
 */
export async function pollRevocations(deps: PollDeps): Promise<PollResult> {
  const previous = await readRevokedDoc(deps.area);
  const cursor = previous?.cursor ?? 0;

  let page = await fetchPage(deps, cursor);
  if (page === undefined) return { ok: false };

  let reset = false;
  let known = previous?.entries ?? [];
  if (cursor > page.latest) {
    page = await fetchPage(deps, 0);
    if (page === undefined) return { ok: false };
    reset = true;
    known = [];
  }

  const byId = new Map(known.map((entry) => [entry.id, entry]));
  for (const entry of page.entries) byId.set(entry.id, entry);

  const doc: RevokedDoc = {
    cursor: page.cursor,
    fetchedAt: (deps.now?.() ?? new Date()).toISOString(),
    entries: [...byId.values()].sort((a, b) => a.id - b.id),
  };
  await deps.area.set({ [REVOKED_KEY]: doc });
  return { ok: true, doc, reset };
}

async function fetchPage(deps: PollDeps, since: number): Promise<RevocationsResponse | undefined> {
  try {
    const response = await deps.fetchFn(`${deps.origin}/api/revocations?since=${since}`);
    if (!response.ok) return undefined;
    const parsed = revocationsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
