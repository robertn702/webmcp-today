import type { Metadata } from "next";
import Link from "next/link";
import { listPackages } from "@/lib/packages-repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse packages",
  description: "Community WebMCP tool packages, newest version of each.",
};

export default async function PackagesPage() {
  const { packages, total } = await listPackages({ page: 1, pageSize: 50 });

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Registry</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Browse packages.</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {total} package{total === 1 ? "" : "s"}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Each one adds tools to a site that never shipped any. Install one and the extension
        registers it on matching pages.
      </p>

      {packages.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          No packages yet.{" "}
          <Link href="/submit" className="text-foreground underline underline-offset-4">
            Publish the first one.
          </Link>
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {packages.map((pkg) => (
            <li key={pkg.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/packages/${pkg.id}`}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {pkg.title}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                  {pkg.urlPatterns.join(", ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {pkg.tools.length} tool{pkg.tools.length === 1 ? "" : "s"} · by {pkg.contributor} ·
                v{pkg.version}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
