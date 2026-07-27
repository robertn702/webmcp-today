import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listPackages } from "@/lib/packages-repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse packages",
  description: "Community WebMCP tool packages, newest version of each.",
};

export default async function PackagesPage() {
  const { packages, total } = await listPackages({ page: 1, pageSize: 50 });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Browse packages</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {total} package{total === 1 ? "" : "s"}. Each one adds tools to a site that never shipped
        any. Install one and the extension registers it on matching pages.
      </p>

      {packages.length === 0 ? (
        <p className="rounded border border-dashed border-border p-8 text-center text-muted-foreground">
          No packages yet.{" "}
          <Link href="/submit" className="underline">
            Publish the first one.
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {packages.map((pkg) => (
            <li key={pkg.id}>
              <Card>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <Link href={`/packages/${pkg.id}`} className="font-semibold hover:underline">
                      {pkg.title}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {pkg.urlPatterns.join(", ")}
                    </span>
                    {/* Install count is the trust signal — a green badge at zero would
                        make an uninstalled package look endorsed. */}
                    {(pkg.installCount ?? 0) > 0 ? (
                      <Badge variant="success">
                        {pkg.installCount} install{pkg.installCount === 1 ? "" : "s"}
                      </Badge>
                    ) : (
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        no installs yet
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pkg.tools.length} tool{pkg.tools.length === 1 ? "" : "s"} · by{" "}
                    {pkg.contributor} · v{pkg.version}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
