import { z } from "zod";

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/robertn702/webmcp-today/releases?per_page=100";
const GITHUB_RELEASES_REVALIDATE_SECONDS = 3600;

const chromeVersionPart = "(?:0|[1-9][0-9]{0,4})";
const chromeVersionPattern = new RegExp(`^${chromeVersionPart}(?:\\.${chromeVersionPart}){0,3}$`);

const githubAssetSchema = z.object({
  name: z.string(),
  browser_download_url: z.url(),
});

const githubReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.url(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  published_at: z.string().nullable(),
  assets: z.array(githubAssetSchema),
});

const githubReleasesSchema = z.array(githubReleaseSchema);

export const extensionReleaseSchema = z.object({
  channel: z.literal("stable"),
  version: z.string().regex(chromeVersionPattern),
  releaseUrl: z.url(),
  downloadUrl: z.url(),
  checksumsUrl: z.url(),
  publishedAt: z.iso.datetime(),
});

export type ExtensionRelease = z.infer<typeof extensionReleaseSchema>;

type ChromeVersion = number[];

function parseChromeVersion(version: string): ChromeVersion | undefined {
  if (!chromeVersionPattern.test(version)) return undefined;
  const parts = version.split(".").map(Number);
  return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 65_535)
    ? parts
    : undefined;
}

function compareChromeVersions(left: ChromeVersion, right: ChromeVersion): number {
  for (let index = 0; index < 4; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Derives the small public update document from GitHub's release metadata. The
 * extension receives only validated URLs for the exact ZIP and checksum asset,
 * never GitHub's full release payload.
 */
export async function getLatestExtensionRelease(
  fetchFn: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ExtensionRelease | undefined> {
  const response = await fetchFn(GITHUB_RELEASES_URL, {
    cache: "force-cache",
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: GITHUB_RELEASES_REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`GitHub releases request failed with ${response.status}`);

  const parsed = githubReleasesSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("GitHub releases response did not match the expected shape");

  let latest: { release: ExtensionRelease; version: ChromeVersion } | undefined;
  for (const release of parsed.data) {
    if (release.draft || release.prerelease || release.published_at === null) continue;
    const version = release.tag_name.slice("extension-v".length);
    const parsedVersion = release.tag_name.startsWith("extension-v")
      ? parseChromeVersion(version)
      : undefined;
    if (parsedVersion === undefined) continue;

    const downloadUrl = release.assets.find(
      (asset) => asset.name === `webmcp-today-extension-${version}.zip`,
    )?.browser_download_url;
    const checksumsUrl = release.assets.find(
      (asset) => asset.name === "SHA256SUMS",
    )?.browser_download_url;
    const candidate = extensionReleaseSchema.safeParse({
      channel: "stable",
      version,
      releaseUrl: release.html_url,
      downloadUrl,
      checksumsUrl,
      publishedAt: release.published_at,
    });
    if (!candidate.success) continue;

    if (latest === undefined || compareChromeVersions(parsedVersion, latest.version) > 0) {
      latest = { release: candidate.data, version: parsedVersion };
    }
  }

  return latest?.release;
}
