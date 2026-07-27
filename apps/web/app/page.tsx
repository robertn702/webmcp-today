import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { FlowDiagram } from "@/components/landing/flow-diagram";
import {
  inBrowserNodes,
  inBrowserSteps,
  llmFirstNodes,
  llmFirstSteps,
} from "@/components/landing/mode-flows";
import { ToolMenu } from "@/components/landing/tool-menu";
import { Button } from "@/components/ui/button";
import { listPackages } from "@/lib/packages-repo";

export const dynamic = "force-dynamic";

// TODO(extension): swap /extension for the Chrome Web Store listing once the
// extension is published. Until then the stub page explains how to run it from
// source — nothing on this site works without the extension installed.
const EXTENSION_HREF = "/extension";

type Stats = { packages: number; tools: number; domains: number };

/**
 * Registry counters for the hero. One page fetch, wide enough to cover the
 * whole registry today; the landing page must still render if the DB is down,
 * so a failure just drops the strip.
 */
async function loadStats(): Promise<Stats | null> {
  try {
    const { packages, total } = await listPackages({ page: 1, pageSize: 100 });
    if (packages.length < total) return { packages: total, tools: 0, domains: 0 };
    return {
      packages: total,
      tools: packages.reduce((sum, pkg) => sum + pkg.tools.length, 0),
      domains: new Set(packages.map((pkg) => pkg.domain)).size,
    };
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const stats = await loadStats();

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b">
        <div className="cafe-atmosphere pointer-events-none absolute inset-0" aria-hidden />
        <div className="cafe-grid pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative mx-auto grid max-w-5xl gap-12 px-4 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-14 lg:pt-24 lg:pb-28">
          <div>
            <p className="cafe-rise font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              WebMCP tool registry
            </p>

            <h1 className="cafe-rise mt-6 font-display text-5xl leading-[0.95] tracking-tight [animation-delay:80ms] sm:text-6xl lg:text-7xl">
              Install the tools a site <em className="text-brand not-italic">never shipped</em>.
            </h1>

            <p className="cafe-rise mt-6 max-w-xl text-base leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-lg">
              Agents guess at the DOM because almost no site publishes real tools. Install a package
              here and the extension registers its tools on the page, so your agent calls{" "}
              <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
                reddit_comment
              </code>{" "}
              instead of hunting for the reply box.
            </p>

            <div className="cafe-rise mt-8 flex flex-wrap items-center gap-3 [animation-delay:240ms]">
              <Button
                asChild
                className="h-11 gap-2 bg-brand px-5 text-[0.95rem] text-brand-contrast hover:bg-brand/90"
              >
                <Link href={EXTENSION_HREF}>
                  <Download className="size-4" />
                  Get the extension
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 gap-2 px-5 text-[0.95rem]">
                <Link href="/packages">
                  Browse the registry
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <p className="cafe-rise mt-4 font-mono text-xs text-muted-foreground [animation-delay:280ms]">
              Requires Chrome 149+ with the WebMCP testing flag enabled
            </p>

            {stats ? (
              <dl className="cafe-rise mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t pt-6 [animation-delay:340ms]">
                <Stat label="packages published" value={stats.packages} />
                {stats.tools > 0 ? <Stat label="tools available" value={stats.tools} /> : null}
                {stats.domains > 0 ? <Stat label="domains covered" value={stats.domains} /> : null}
              </dl>
            ) : null}
          </div>

          <ToolMenu />
        </div>
      </section>

      {/* ----------------------------------------------------------- why it exists */}
      <section className="border-b">
        <div className="mx-auto grid max-w-5xl divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-0">
          <Reason
            index="01"
            title="Sites won't do this for you"
            body="WebMCP is a live W3C proposal and adoption is roughly zero. The sites you use every day won't be first. They'd never ship the tools you actually want anyway."
          />
          <Reason
            index="02"
            title="Scraping rots quietly"
            body="A selector breaks the day a class name changes and nothing tells you. A package that declares the site's own HTTP API fails loudly instead. A 4xx you can see beats a div you can't find."
          />
          <Reason
            index="03"
            title="Agents can write packages"
            body="A package is data. URL patterns, tool descriptions, and either DOM steps or an API block. Publishing is one API call. The agent that needed the tool can be the one that contributes it."
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- modes */}
      <section className="mx-auto max-w-5xl px-4 py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            How it runs
          </p>
          <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Two ways in.</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Same registry, same packages, same execution engine. The difference is where the agent
            sits. It can run outside the browser and talk to the registry over MCP, or run inside
            the page on tools the extension already injected. Step through each one.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-14">
          <ModeCard
            index="Mode 01"
            title="From your terminal"
            summary="An agent outside the browser, like Claude Code or any other MCP client, searches the registry, publishes what's missing, and pins an install. The extension delivers that exact version into the page."
          >
            <FlowDiagram
              nodes={llmFirstNodes}
              steps={llmFirstSteps}
              label="From your terminal, an agent uses the Cafe MCP server to find, publish and install packages, which the extension then registers on the target site."
            />
          </ModeCard>

          <ModeCard
            index="Mode 02"
            title="In the browser"
            summary="No terminal, no API key. The extension looks up packages for whatever page you're on and registers their tools, and the browser's own agent picks them up as if the site had shipped them."
          >
            <FlowDiagram
              nodes={inBrowserNodes}
              steps={inBrowserSteps}
              label="In the browser, the extension fetches packages for the current URL and registers their tools on document.modelContext, where the browser's agent invokes them."
            />
          </ModeCard>
        </div>
      </section>

      {/* ---------------------------------------------------------------- trust */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20 lg:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Trust model
            </p>
            <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
              Read it before you run it.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              A package registers tools on pages you&apos;re signed into. So nothing here asks you
              to take our word for it.
            </p>
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <TrustFact title="The source is public">
              The extension, this registry, the schema and the MCP server all live in one GitHub
              repo. What the extension does with a package is code you can read.
            </TrustFact>
            <TrustFact title="Packages are data, not code">
              A package is a JSON document. URL patterns, tool descriptions, and either DOM steps or
              an API block. Nothing in it can run arbitrary code in your page.
            </TrustFact>
            <TrustFact title="You see every tool first">
              The package page lists each tool it registers and what that tool takes. Nothing shows
              up on a page you didn&apos;t already read.
            </TrustFact>
            <TrustFact title="Updates can’t ambush you">
              Your install is pinned to one version, and a published version is never edited. A bad
              update reaches you when you move the pin and not before. Rolling back means moving it
              back.
            </TrustFact>
            <TrustFact title="A call can’t leave the site">
              API mode is locked to the package&apos;s own origin, checked when it&apos;s published
              and again when it runs. Your session on one site stays there.
            </TrustFact>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild variant="outline" className="h-11 gap-2 px-5 text-[0.95rem]">
              <a href="https://github.com/robertn702/webmcp-cafe">
                Read the source
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ closing CTA */}
      <section className="mx-auto max-w-5xl px-4 py-20 lg:py-28">
        <div className="flex flex-col items-start gap-8 rounded-2xl border bg-card px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Nothing runs without the extension.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Install it once, add a package, and the tools are there next time you open the site.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Button
              asChild
              className="h-11 gap-2 bg-brand px-5 text-[0.95rem] text-brand-contrast hover:bg-brand/90"
            >
              <Link href={EXTENSION_HREF}>
                <Download className="size-4" />
                Get the extension
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 gap-2 px-5 text-[0.95rem]">
              <Link href="/submit">
                Publish a package
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-display text-3xl">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

function Reason({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="py-10 sm:px-8">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand">{index}</p>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function ModeCard({
  index,
  title,
  summary,
  children,
}: {
  index: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border bg-card px-5 py-8 sm:px-8 sm:py-10">
      <header className="max-w-2xl border-b pb-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">{index}</p>
        <h3 className="mt-3 font-display text-3xl tracking-tight">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{summary}</p>
      </header>
      <div className="pt-10">{children}</div>
    </article>
  );
}

function TrustFact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-brand/30 pl-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
