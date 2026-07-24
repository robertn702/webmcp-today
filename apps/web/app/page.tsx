import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listConfigs } from "@/lib/configs-repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { configs, total } = await listConfigs({ page: 1, pageSize: 50 });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Community WebMCP configs</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {total} config{total === 1 ? "" : "s"} teaching agents how to use the web.
      </p>

      {configs.length === 0 ? (
        <p className="rounded border border-dashed border-border p-8 text-center text-muted-foreground">
          No configs yet.{" "}
          <Link href="/submit" className="underline">
            Submit the first one.
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {configs.map((config) => (
            <li key={config.id}>
              <Card>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <Link href={`/configs/${config.id}`} className="font-semibold hover:underline">
                      {config.title}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {config.urlPatterns.join(", ")}
                    </span>
                    <Badge variant="success">{config.installCount ?? 0} installs</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {config.tools.length} tool{config.tools.length === 1 ? "" : "s"} · by{" "}
                    {config.contributor} · v{config.version}
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
