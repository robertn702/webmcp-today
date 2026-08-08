import { describe, expect, it } from "vitest";
import { getLatestExtensionRelease } from "@/lib/extension-release";

function githubRelease(
  version: string,
  options: { draft?: boolean; prerelease?: boolean; zip?: boolean; checksums?: boolean } = {},
) {
  return {
    tag_name: `extension-v${version}`,
    html_url: `https://github.com/robertn702/webmcp-today/releases/tag/extension-v${version}`,
    draft: options.draft ?? false,
    prerelease: options.prerelease ?? false,
    published_at: "2026-08-05T12:00:00Z",
    assets: [
      ...(options.zip === false
        ? []
        : [
            {
              name: `webmcp-today-extension-${version}.zip`,
              browser_download_url: `https://example.test/${version}.zip`,
            },
          ]),
      ...(options.checksums === false
        ? []
        : [
            {
              name: "SHA256SUMS",
              browser_download_url: `https://example.test/${version}-SHA256SUMS`,
            },
          ]),
    ],
  };
}

function fetchReleases(
  body: unknown,
): [(url: string, init?: RequestInit) => Promise<Response>, RequestInit[]] {
  const inits: RequestInit[] = [];
  return [
    async (_url, init) => {
      if (init !== undefined) inits.push(init);
      return new Response(JSON.stringify(body), { status: 200 });
    },
    inits,
  ];
}

describe("getLatestExtensionRelease", () => {
  it("chooses the highest valid stable extension release", async () => {
    const [fetchFn, inits] = fetchReleases([
      githubRelease("1.0.2"),
      githubRelease("1.0.10"),
      githubRelease("1.1"),
    ]);
    const release = await getLatestExtensionRelease(fetchFn);

    expect(release).toEqual({
      channel: "stable",
      version: "1.1",
      releaseUrl: "https://github.com/robertn702/webmcp-today/releases/tag/extension-v1.1",
      downloadUrl: "https://example.test/1.1.zip",
      checksumsUrl: "https://example.test/1.1-SHA256SUMS",
      publishedAt: "2026-08-05T12:00:00Z",
    });
    expect(inits).toEqual([
      expect.objectContaining({ cache: "force-cache", next: { revalidate: 3600 } }),
    ]);
  });

  it("rejects draft, prerelease, malformed, and incomplete releases", async () => {
    const invalidTag = githubRelease("1.0.3");
    invalidTag.tag_name = "package-v1.0.3";
    const [fetchFn] = fetchReleases([
      githubRelease("1.0.4", { draft: true }),
      githubRelease("1.0.5", { prerelease: true }),
      githubRelease("1.0.6", { zip: false }),
      githubRelease("1.0.7", { checksums: false }),
      invalidTag,
    ]);
    const release = await getLatestExtensionRelease(fetchFn);

    expect(release).toBeUndefined();
  });
});
