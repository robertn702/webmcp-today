import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/stats/route";

const state = vi.hoisted((): { packages: { domain: string }[] } => ({ packages: [] }));

vi.mock("@/lib/packages-repo", () => ({
  listServablePackages: () => Promise.resolve(state.packages),
}));

describe("GET /api/stats", () => {
  beforeEach(() => {
    state.packages = [];
  });

  it("aggregates only the servable package set", async () => {
    state.packages = [
      { domain: "reddit.com" },
      { domain: "reddit.com" },
      { domain: "news.ycombinator.com" },
    ];

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      totalPackages: 3,
      totalDomains: 2,
      topDomains: [
        { domain: "reddit.com", count: 2 },
        { domain: "news.ycombinator.com", count: 1 },
      ],
    });
  });
});
