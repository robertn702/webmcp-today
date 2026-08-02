import { source } from "@/lib/source";

const intro = "# WebMCP Today documentation\n\nWebMCP Today is a community registry of inspectable, same-origin API tool packages for the agentic web.\n";

export function GET() {
  const pages = source.getPages();
  const body = pages
    .map((page) => `- [${page.data.title}](https://webmcp.today${page.url}.md): ${page.data.description}`)
    .join("\n");

  return new Response(`${intro}\n## Pages\n\n${body}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
