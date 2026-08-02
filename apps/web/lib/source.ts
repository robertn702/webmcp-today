import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";
import { EXAMPLE_PACKAGE_JSON } from "@/lib/docs";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export async function getDocumentationMarkdown(slug: string[] = []) {
  const page = source.getPage(slug);
  if (page === undefined) return undefined;

  return (await page.data.getText("processed"))
    .replace("<ExamplePackage />", `\`\`\`json\n${EXAMPLE_PACKAGE_JSON}\n\`\`\``)
    .replace("<WebMcpReadiness />", "The interactive documentation page includes a browser runtime readiness check.");
}
