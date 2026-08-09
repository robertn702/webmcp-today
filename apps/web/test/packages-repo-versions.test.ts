import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(
  (): {
    packageRows: { domain: string }[];
    versionRows: {
      id: string;
      version: number;
      urlPatterns: string[];
      api: { baseUrl: string };
      changelog: string | null;
      createdAt: Date;
    }[];
  } => ({ packageRows: [], versionRows: [] }),
);

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(state.packageRows),
          orderBy: () => Promise.resolve(state.versionRows),
        }),
      }),
    }),
  },
}));

import { listVersions } from "@/lib/packages-repo";

const API_BLOCK = { baseUrl: "https://reddit.com" };

describe("listVersions", () => {
  beforeEach(() => {
    state.packageRows = [{ domain: "reddit.com" }];
    state.versionRows = [
      {
        id: "ver-3",
        version: 3,
        urlPatterns: ["*://*/*"],
        api: API_BLOCK,
        changelog: "Unsafe legacy scope",
        createdAt: new Date("2026-07-03T00:00:00.000Z"),
      },
      {
        id: "ver-2",
        version: 2,
        urlPatterns: ["*://*.reddit.com/*"],
        api: API_BLOCK,
        changelog: "Safe version",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      },
      {
        id: "ver-1",
        version: 1,
        urlPatterns: ["*://reddit.com/*"],
        api: API_BLOCK,
        changelog: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ];
  });

  it("excludes unsafe legacy versions while preserving newest-first safe order", async () => {
    await expect(listVersions("pkg-1")).resolves.toEqual([
      {
        versionId: "ver-2",
        version: 2,
        changelog: "Safe version",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      },
      {
        versionId: "ver-1",
        version: 1,
        changelog: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
  });

  it("retains the empty result used for the versions endpoint's 404", async () => {
    const latest = state.versionRows[0];
    if (!latest) throw new Error("fixture missing latest version");
    state.versionRows = [{ ...latest, urlPatterns: ["*://*/*"] }];
    await expect(listVersions("pkg-1")).resolves.toEqual([]);
  });
});
