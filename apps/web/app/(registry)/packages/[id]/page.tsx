import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InstallButton } from "@/components/install-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPackageById, getVersionById } from "@/lib/packages-repo";

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
  const installTarget = install ? await getVersionById(id, install) : null;
  const targetVersionId = installTarget?.id ?? pkg.versionId;
  const targetVersion = installTarget?.version ?? pkg.version;

  return (
    <div>
      <h1 className="text-2xl font-bold">{pkg.title}</h1>
      <p className="mt-1 font-mono text-sm text-muted-foreground">{pkg.urlPatterns.join(", ")}</p>
      <p className="mt-3 text-sm text-muted-foreground">{pkg.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        by {pkg.contributor} · v{pkg.version} · updated{" "}
        {new Date(pkg.updatedAt).toLocaleDateString()}
      </p>
      {pkg.changelog && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold">What changed in v{pkg.version}:</span> {pkg.changelog}
        </p>
      )}
      <div className="mt-4">
        <InstallButton
          packageId={pkg.id}
          versionId={targetVersionId}
          version={targetVersion}
          autoFocus={installTarget !== null}
        />
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Installing saves v{pkg.version} in your browser — nothing is tied to your account. The
          extension registers its tools whenever you&apos;re on a matching page, and you stay on v
          {pkg.version} until you update.
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Needs the extension on Chrome 149+ with the WebMCP testing flag.{" "}
          <Link href="/extension" className="text-foreground underline underline-offset-4">
            Get the extension →
          </Link>
        </p>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Tools ({pkg.tools.length})</h2>
      <ul className="flex flex-col gap-4">
        {pkg.tools.map((tool) => (
          <li key={tool.name}>
            <Card>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <code className="font-semibold">{tool.name}</code>
                  {tool.annotations?.readOnlyHint && <Badge variant="success">read-only</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Show input schema and execution steps
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(
                      { inputSchema: tool.inputSchema, execution: tool.execution },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
