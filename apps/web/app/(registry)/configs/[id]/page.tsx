import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InstallButton } from "@/components/install-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getConfigById } from "@/lib/configs-repo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Missing package is the 404 path, not an error path — the page itself calls
  // notFound(); metadata just falls back to the root title.
  const config = await getConfigById(id);
  if (!config) return { title: "Package not found" };
  return { title: config.title, description: config.description };
}

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await getConfigById(id);
  if (!config) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">{config.title}</h1>
      <p className="mt-1 font-mono text-sm text-muted-foreground">
        {config.urlPatterns.join(", ")}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{config.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        by {config.contributor} · v{config.version} · {config.installCount ?? 0} installs · updated{" "}
        {new Date(config.updatedAt).toLocaleDateString()}
      </p>
      {config.changelog && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold">What changed in v{config.version}:</span>{" "}
          {config.changelog}
        </p>
      )}
      <div className="mt-4">
        <InstallButton configId={config.id} />
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Installing adds this package to your account at v{config.version}. The extension registers
          its tools whenever you&apos;re on a matching page. You stay on v{config.version} until you
          update.
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Needs the extension on Chrome 149+ with the WebMCP testing flag.{" "}
          <Link href="/extension" className="text-foreground underline underline-offset-4">
            Get the extension →
          </Link>
        </p>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Tools ({config.tools.length})</h2>
      <ul className="flex flex-col gap-4">
        {config.tools.map((tool) => (
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
