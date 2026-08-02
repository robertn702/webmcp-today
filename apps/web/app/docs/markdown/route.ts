import { getDocumentationMarkdown } from "@/lib/source";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const markdown = await getDocumentationMarkdown(slug === null ? [] : [slug]);
  if (markdown === undefined) return new Response("Not found", { status: 404 });

  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
