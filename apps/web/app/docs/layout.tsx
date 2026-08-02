import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsSearch } from "@/components/docs-search";
import { source } from "@/lib/source";

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-4 sm:px-6">
        <DocsSearch />
      </div>
      <DocsLayout
        tree={source.getPageTree()}
        nav={{ title: "WebMCP Today docs" }}
        sidebar={{ className: "border-r" }}
      >
        {children}
      </DocsLayout>
    </section>
  );
}
