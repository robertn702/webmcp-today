import { describe, expect, it, vi } from "vitest";

const API_BLOCK = {
  baseUrl: "https://reddit.com",
  endpoints: { me: { method: "GET", path: "/api/me.json" } },
};

const state = vi.hoisted(
  (): {
    versionRows: {
      id: string;
      packageId: string;
      version: number;
      urlPatterns: string[];
      tools: [];
      api: { baseUrl: string; endpoints: Record<string, unknown> };
      apiContentHash: null;
      minEngine: number;
      changelog: null;
      createdAt: Date;
    }[];
  } => ({ versionRows: [] }),
);

vi.mock("@/lib/db", () => ({
  db: {
    select: (fields?: unknown) => ({
      from: () => ({
        where: () =>
          Promise.resolve(
            fields === undefined ? state.versionRows : [{ id: "user-1", name: "Robert" }],
          ),
      }),
    }),
  },
}));

import { hydratePackages } from "@/lib/packages-repo";

describe("hydratePackages", () => {
  it("serves the newest safe version when a newer legacy row is unsafe", async () => {
    state.versionRows = [
      {
        id: "ver-unsafe",
        packageId: "pkg-1",
        version: 3,
        // A global wildcard is what makes this version unsafe, not its api block.
        urlPatterns: ["*://*/*"],
        tools: [],
        api: API_BLOCK,
        apiContentHash: null,
        minEngine: 1,
        changelog: null,
        createdAt: new Date("2026-07-03T00:00:00.000Z"),
      },
      {
        id: "ver-safe",
        packageId: "pkg-1",
        version: 2,
        urlPatterns: ["*://*.reddit.com/*"],
        tools: [],
        api: API_BLOCK,
        apiContentHash: null,
        minEngine: 1,
        changelog: null,
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      },
    ];

    const result = await hydratePackages([
      {
        id: "pkg-1",
        domain: "reddit.com",
        pageType: null,
        title: "Reddit",
        description: "Read Reddit",
        contributorId: "user-1",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-03T00:00:00.000Z"),
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.versionId).toBe("ver-safe");
    expect(result[0]?.version).toBe(2);
  });
});
