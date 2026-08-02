import { getDocumentationMarkdown, source } from "@/lib/source";

export async function GET() {
  const pages = source.getPages();
  const documents = await Promise.all(
    pages.map(async (page) => `# ${page.data.title}\n\n${await getDocumentationMarkdown(page.slugs)}`),
  );

  return new Response(documents.join("\n\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
