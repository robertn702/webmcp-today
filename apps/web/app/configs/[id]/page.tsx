import { notFound } from "next/navigation";
import { VerifyButton } from "@/components/verify-button";
import { VoteButtons } from "@/components/vote-buttons";
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
      <p className="mt-1 font-mono text-sm text-stone-500">{config.urlPattern}</p>
      <p className="mt-3 text-sm text-stone-700">{config.description}</p>
      <p className="mt-2 text-xs text-stone-500">
        by {config.contributor} · v{config.version} · updated{" "}
        {new Date(config.updatedAt).toLocaleDateString()}
      </p>
      <div className="mt-4">
        <VoteButtons configId={config.id} />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Tools ({config.tools.length})</h2>
      <ul className="space-y-4">
        {config.tools.map((tool) => (
          <li key={tool.name} className="rounded border border-stone-200 bg-white p-4">
            <div className="flex items-baseline gap-2">
              <code className="font-semibold">{tool.name}</code>
              {verifiedNames.has(tool.name) ? (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                  verified
                </span>
              ) : (
                <>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    unverified
                  </span>
                  <VerifyButton configId={config.id} toolName={tool.name} />
                </>
              )}
            </div>
            <p className="mt-1 text-sm text-stone-600">{tool.description}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-stone-500">
                inputSchema + execution
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-stone-100 p-3 text-xs">
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
