import { notFound } from "next/navigation";
import { VerifyButton } from "@/components/verify-button";
import { VoteButtons } from "@/components/vote-buttons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getConfigById } from "@/lib/configs-repo";

export const dynamic = "force-dynamic";

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await getConfigById(id, true);
  if (!config) notFound();

  const verifiedNames = new Set(config.verifiedToolNames ?? []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{config.title}</h1>
      <p className="mt-1 font-mono text-sm text-muted-foreground">{config.urlPattern}</p>
      <p className="mt-3 text-sm text-muted-foreground">{config.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        by {config.contributor} · v{config.version} · updated{" "}
        {new Date(config.updatedAt).toLocaleDateString()}
      </p>
      <div className="mt-4">
        <VoteButtons configId={config.id} />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Tools ({config.tools.length})</h2>
      <ul className="flex flex-col gap-4">
        {config.tools.map((tool) => (
          <li key={tool.name}>
            <Card>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <code className="font-semibold">{tool.name}</code>
                  {verifiedNames.has(tool.name) ? (
                    <Badge variant="success">verified</Badge>
                  ) : (
                    <>
                      <Badge variant="warning">unverified</Badge>
                      <VerifyButton configId={config.id} toolName={tool.name} />
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    inputSchema + execution
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
