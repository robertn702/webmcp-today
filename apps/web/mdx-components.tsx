import type { MDXComponents } from "mdx/types";
import defaultComponents from "fumadocs-ui/mdx";
import { CopyBlock } from "@/components/copy-block";
import { WebMcpReadiness } from "@/components/webmcp-readiness";
import { EXAMPLE_PACKAGE_JSON } from "@/lib/docs";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    CopyBlock,
    ExamplePackage: () => <CopyBlock label="Copy package JSON">{EXAMPLE_PACKAGE_JSON}</CopyBlock>,
    WebMcpReadiness,
    ...components,
  };
}
