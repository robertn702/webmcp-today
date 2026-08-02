import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { DocsPageActions } from "@/components/docs-page-actions";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/lib/source";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (page === undefined) return {};

  return {
    title: page.data.title,
    description: page.data.description,
  };
}

export default async function DocumentationPage({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (page === undefined) notFound();

  const markdown = await page.data.getText("processed");
  const MDX = page.data.body;
  const markdownUrl = `${page.url}.md`;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="mt-5">
        <DocsPageActions markdown={markdown} markdownUrl={markdownUrl} />
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
