import { beforeEach, describe, expect, it, vi } from "vitest";
import sitemap, { dynamic } from "@/app/sitemap";

const state = vi.hoisted((): { packages: { id: string; updatedAt: string }[] } => ({
  packages: [],
}));

vi.mock("@/lib/packages-repo", () => ({
  listServablePackages: () => Promise.resolve(state.packages),
}));

describe("sitemap", () => {
  beforeEach(() => {
    state.packages = [];
  });

  it("is dynamically rendered to query the current servable package corpus", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("includes only public static routes", async () => {
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://webmcp.today",
      "https://webmcp.today/packages",
      "https://webmcp.today/docs",
      "https://webmcp.today/docs/quickstart",
      "https://webmcp.today/docs/package-format",
      "https://webmcp.today/extension",
      "https://webmcp.today/privacy",
      "https://webmcp.today/terms",
    ]);
  });

  it("includes every servable package with its update timestamp", async () => {
    state.packages = [
      { id: "reddit", updatedAt: "2026-08-01T12:00:00.000Z" },
      { id: "hacker-news", updatedAt: "2026-08-02T12:00:00.000Z" },
    ];

    const entries = await sitemap();

    expect(entries.slice(8)).toEqual([
      {
        url: "https://webmcp.today/packages/reddit",
        lastModified: "2026-08-01T12:00:00.000Z",
        changeFrequency: "weekly",
        priority: 0.6,
      },
      {
        url: "https://webmcp.today/packages/hacker-news",
        lastModified: "2026-08-02T12:00:00.000Z",
        changeFrequency: "weekly",
        priority: 0.6,
      },
    ]);
  });
});
