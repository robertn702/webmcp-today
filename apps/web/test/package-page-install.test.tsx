import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

const state = vi.hoisted(
  (): {
    installTarget: {
      id: string;
      versionId: string;
      version: number;
      domain: string;
      urlPatterns: string[];
      title: string;
      description: string;
      api: {
        baseUrl: string;
        endpoints: Record<string, { baseUrl?: string }>;
      };
      tools: [];
      contributor: string;
      createdAt: string;
      updatedAt: string;
    } | null;
  } => ({ installTarget: null }),
);

vi.mock("@/lib/packages-repo", () => ({
  getPackageById: () =>
    Promise.resolve({
      id: "pkg-1",
      versionId: "ver-current",
      version: 2,
      domain: "reddit.com",
      urlPatterns: ["*://*.reddit.com/*"],
      title: "Reddit",
      description: "Read Reddit",
      api: { baseUrl: "https://www.reddit.com", endpoints: {} },
      tools: [],
      contributor: "robert",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    }),
  getPackageAtVersion: () => Promise.resolve(state.installTarget),
}));

vi.mock("@/components/install-button", () => ({
  InstallButton: ({ versionId, version }: { versionId: string; version: number }) => (
    <button data-version={version} data-version-id={versionId} type="button" />
  ),
}));

import PackagePage from "@/app/(registry)/packages/[id]/page";

describe("package install handoff", () => {
  beforeEach(() => {
    state.installTarget = null;
  });

  it("falls back to the current safe version when the requested historic version is unsafe", async () => {
    const page = await PackagePage({
      params: Promise.resolve({ id: "pkg-1" }),
      searchParams: Promise.resolve({ install: "ver-unsafe" }),
    });

    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('data-version="2"');
    expect(markup).toContain('data-version-id="ver-current"');
  });

  it("uses the requested safe version's version ID", async () => {
    state.installTarget = {
      id: "pkg-1",
      versionId: "ver-previous",
      version: 1,
      domain: "reddit.com",
      urlPatterns: ["*://old.reddit.com/*"],
      title: "Previous Reddit",
      description: "Read old Reddit",
      api: {
        baseUrl: "https://www.reddit.com",
        endpoints: { read: { baseUrl: "https://api.reddit.example" } },
      },
      tools: [],
      contributor: "robert",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };

    const page = await PackagePage({
      params: Promise.resolve({ id: "pkg-1" }),
      searchParams: Promise.resolve({ install: "ver-previous" }),
    });

    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('data-version="1"');
    expect(markup).toContain('data-version-id="ver-previous"');
    expect(markup).toContain("Previous Reddit");
    expect(markup).not.toContain("Read Reddit");
    expect(markup).toContain("https://api.reddit.example");
    expect(markup).toContain("No cookies or site credentials are included.");
  });
});
