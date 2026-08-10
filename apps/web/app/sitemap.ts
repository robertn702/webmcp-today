import type { MetadataRoute } from "next";
import { listServablePackages } from "@/lib/packages-repo";

export const dynamic = "force-dynamic";

const siteUrl = "https://webmcp.today";

const staticEntries: MetadataRoute.Sitemap = [
  { url: siteUrl, changeFrequency: "weekly", priority: 1 },
  { url: `${siteUrl}/packages`, changeFrequency: "daily", priority: 0.9 },
  { url: `${siteUrl}/docs`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${siteUrl}/docs/quickstart`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${siteUrl}/docs/package-format`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${siteUrl}/extension`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const packages = await listServablePackages();

  return [
    ...staticEntries,
    ...packages.map((pkg) => ({
      url: `${siteUrl}/packages/${pkg.id}`,
      lastModified: pkg.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
