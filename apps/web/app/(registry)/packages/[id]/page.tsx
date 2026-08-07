import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";
import { InstallButton } from "@/components/install-button";
import { Badge } from "@/components/ui/badge";
import { getPackageAtVersion, getPackageById } from "@/lib/packages-repo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Missing package is the 404 path, not an error path — the page itself calls
  // notFound(); metadata just falls back to the root title.
  const pkg = await getPackageById(id);
  if (!pkg) return { title: "Package not found" };
  return { title: pkg.title, description: pkg.description };
}

export default async function PackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ install?: string }>;
}) {
  const { id } = await params;
  const { install } = await searchParams;
  const pkg = await getPackageById(id);
  if (!pkg) notFound();

  // ?install=<versionId> is the MCP handoff link (install_package's installUrl) —
  // pre-arm the button at that exact version instead of the page's latest.
  const installTarget = install ? await getPackageAtVersion(id, install) : null;
  const displayedPackage = installTarget ?? pkg;
  const targetVersionId = installTarget?.versionId ?? pkg.versionId;
  const targetVersion = installTarget?.version ?? pkg.version;

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">
        {displayedPackage.domain}
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">{displayedPackage.title}</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        by {displayedPackage.contributor} · v{displayedPackage.version} · updated{" "}
        {new Date(displayedPackage.updatedAt).toLocaleDateString()}
      </p>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        {displayedPackage.urlPatterns.join(", ")}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {displayedPackage.description}
      </p>
      {displayedPackage.changelog && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold">What changed in v{displayedPackage.version}:</span>{" "}
          {displayedPackage.changelog}
        </p>
      )}
      <div className="mt-4">
        <InstallButton
          packageId={pkg.id}
          versionId={targetVersionId}
          version={targetVersion}
          autoFocus={installTarget !== null}
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Installing saves v{targetVersion} in your browser, not on your account. The extension
          registers its tools whenever you&apos;re on a matching page, and you stay on v
          {targetVersion} until you update.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Needs the extension in a supported Chrome or Brave browser; the WebMCP testing flag is
          only needed for Chrome&apos;s native agent, not for the bridge.{" "}
          <Link href="/extension" className="text-foreground underline underline-offset-4">
            Get the extension →
          </Link>
        </p>
      </div>

      <h2 className="mt-10 text-sm font-semibold">Tools ({displayedPackage.tools.length})</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {displayedPackage.tools.map((tool) => (
          <li key={tool.name} className="rounded-2xl border bg-card p-4">
            <div className="flex items-baseline gap-2">
              <code className="font-semibold">{tool.name}</code>
              {tool.annotations?.readOnlyHint && <Badge variant="success">read-only</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Show input schema and execution
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {JSON.stringify(
                  { inputSchema: tool.inputSchema, execution: tool.execution },
                  null,
                  2,
                )}
              </pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
