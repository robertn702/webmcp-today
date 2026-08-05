"use client";

import { CopyButton } from "@/components/copy-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MCP_CLIENT_CONFIGS } from "@/app/(registry)/docs/content";

export function McpClientConfigs() {
  return (
    <Tabs
      defaultValue={MCP_CLIENT_CONFIGS[0].id}
      className="mt-3 gap-0 overflow-hidden rounded-lg border bg-muted/50"
    >
      <div className="border-b bg-card px-1 py-1.5">
        <TabsList
          variant="line"
          aria-label="MCP client configuration"
          className="h-auto! flex-wrap justify-start gap-y-1.5"
        >
          {MCP_CLIENT_CONFIGS.map((client) => (
            <TabsTrigger key={client.id} value={client.id}>
              {client.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {MCP_CLIENT_CONFIGS.map((client) => (
        <TabsContent key={client.id} value={client.id} tabIndex={-1}>
          <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
            <p className="text-xs text-muted-foreground">
              {client.instruction}
              {client.format === "sh" ? null : (
                <>
                  {" "}
                  <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
                    {client.location}
                  </code>
                  :
                </>
              )}
            </p>
            <CopyButton text={client.configuration} />
          </div>
          <pre className="overflow-x-auto px-3 py-3 font-mono text-xs whitespace-pre-wrap">
            {client.configuration}
          </pre>
        </TabsContent>
      ))}
    </Tabs>
  );
}
