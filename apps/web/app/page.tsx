import Link from "next/link";
import { listConfigs } from "@/lib/configs-repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { configs, total } = await listConfigs({ page: 1, pageSize: 50, yolo: true });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Community WebMCP configs</h1>
      <p className="mb-6 text-sm text-stone-600">
        {total} config{total === 1 ? "" : "s"} teaching agents how to use the web.
      </p>

      {configs.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No configs yet.{" "}
          <Link href="/submit" className="underline">
            Submit the first one.
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {configs.map((config) => (
            <li key={config.id} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex items-baseline gap-2">
                <Link href={`/configs/${config.id}`} className="font-semibold hover:underline">
                  {config.title}
                </Link>
                <span className="font-mono text-xs text-stone-500">{config.urlPattern}</span>
                {config.verified ? (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                    verified
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    unverified
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-stone-600">{config.description}</p>
              <p className="mt-2 text-xs text-stone-500">
                {config.tools.length} tool{config.tools.length === 1 ? "" : "s"} · by{" "}
                {config.contributor} · v{config.version}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
