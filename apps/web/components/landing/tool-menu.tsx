import { cn } from "@/lib/utils";

/**
 * Hero visual: what an agent sees once a package is injected, laid out like a
 * cafe menu board. Illustrative — the tool names are the ones from the Reddit
 * tier-1 package in docs/api-execution-model.md.
 */

const TOOLS = [
  {
    name: "reddit_subreddit_hot",
    kind: "read",
    description: "List hot posts in a subreddit.",
  },
  {
    name: "reddit_search",
    kind: "read",
    description: "Search posts using the site's own GraphQL API.",
  },
  {
    name: "reddit_comment",
    kind: "write",
    description: "Post a comment or reply. Confirms before it writes.",
  },
] as const;

export function ToolMenu() {
  return (
    <div className="cafe-rise rounded-2xl border bg-card/80 shadow-xl shadow-black/5 backdrop-blur-sm [animation-delay:320ms]">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Tools on this page
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">reddit.com</p>
      </div>

      <ul className="divide-y">
        {TOOLS.map((tool, i) => (
          <li
            key={tool.name}
            className="cafe-rise flex items-start justify-between gap-4 px-5 py-3.5"
            style={{ animationDelay: `${420 + i * 110}ms` }}
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-medium">{tool.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
            </div>
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
                tool.kind === "write"
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "text-muted-foreground",
              )}
            >
              {tool.kind}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t px-5 py-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          <span className="text-brand">●</span> injected by webmcp.cafe · community package · pinned
          v1
        </p>
      </div>
    </div>
  );
}
