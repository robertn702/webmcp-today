import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { EXTENSION_RELEASE_URL } from "@/app/(registry)/docs/content";
import { ToolMenu } from "@/components/landing/tool-menu";
import { Button } from "@/components/ui/button";
import { listPackages } from "@/lib/packages-repo";

export const dynamic = "force-dynamic";

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
              Community WebMCP registry
            </p>

            <h1 className="cafe-rise mt-6 font-display text-5xl leading-[0.95] tracking-tight [animation-delay:80ms] sm:text-6xl lg:text-7xl">
              Make any site agent-ready with
              <em className="text-brand not-italic"> WebMCP Today</em>.
            </h1>

            <p className="cafe-rise mt-6 max-w-xl text-base leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-lg">
              Install or publish a package that gives your agent named tools on sites that have yet
              to adopt WebMCP.
            </p>

            <div className="cafe-rise mt-8 flex flex-wrap items-center gap-3 [animation-delay:240ms]">
              <Button
                asChild
                className="h-11 gap-2 bg-brand px-5 text-[0.95rem] text-brand-contrast hover:bg-brand/90"
              >
                <Link href="/docs/quickstart">
                  Make your first tool call
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 gap-2 px-5 text-[0.95rem]">
                <Link href="/packages">
                  Browse the registry
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>

            <p className="cafe-rise mt-4 font-mono text-xs text-muted-foreground [animation-delay:280ms]">
              Public beta. Supported Chromium runtime, WebMCP when required, unpacked extension.
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
            title="Stop making the model hunt"
            body="A named tool tells the agent what it does, which inputs it needs, and what it returns. No selector archaeology, coordinate guessing, or replayed click script."
          />
          <Reason
            index="02"
            title="Read the whole capability first"
            body="Packages are data, not remote code. The page shows every tool, same-origin endpoint, parameter, and response projection before you install it."
          />
          <Reason
            index="03"
            title="Keep the version you approved"
            body="The extension stores one immutable version in your browser. A new publish cannot change what your agent can do until you choose to update."
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- modes */}
      <section className="mx-auto max-w-5xl px-4 py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            First run
          </p>
          <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
            Make a live tool call from your MCP client
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Load the extension in your existing supported Chromium browser, connect the local MCP
            bridge, then install the suggested Reddit package and call it. The path exposes six
            tools and returns live subreddit data when its final read-only check succeeds.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <RunStep number="1" title="Download and load the extension">
            <a href={EXTENSION_RELEASE_URL} className="underline underline-offset-4">
              Download the release ZIP
            </a>
            , extract it, then load its folder in the browser&apos;s Developer mode.
          </RunStep>
          <RunStep number="2" title="Connect the MCP server to your browser">
            Check the actual WebMCP runtime, install the native host on macOS, and connect the
            first-party MCP server to your existing browser.
          </RunStep>
          <RunStep number="3" title="Install and call a package">
            Open Reddit, approve its suggested package, and call the read-only tool as soon as it
            appears. No webmcp.today account is required.
          </RunStep>
        </div>
        <div className="mt-8">
          <Button
            asChild
            className="h-11 gap-2 bg-brand px-5 text-[0.95rem] text-brand-contrast hover:bg-brand/90"
          >
            <Link href="/docs/quickstart">
              Follow the verified quickstart
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
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
              Built around a trust model you can inspect
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              A package registers tools on pages you&apos;re signed into. You can inspect the
              source, package contents, version history, and API origin before installing it.
            </p>
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <TrustFact title="The source is public">
              The extension, this registry, the schema and the MCP server all live in one{" "}
              <a
                href="https://github.com/robertn702/webmcp-today"
                className="text-foreground underline underline-offset-4"
              >
                GitHub repo
              </a>
              . What the extension does with a package is code you can read.
            </TrustFact>
            <TrustFact title="Packages are data, not code">
              A package is a JSON document. The{" "}
              <a
                href="https://github.com/robertn702/webmcp-today/tree/main/packages/schema"
                className="text-foreground underline underline-offset-4"
              >
                package schema
              </a>{" "}
              has no step that executes code, so installing one can&apos;t run arbitrary code in
              your page.
            </TrustFact>
            <TrustFact title="Updates require your approval">
              Your install is{" "}
              <a
                href="https://github.com/robertn702/webmcp-today/blob/main/packages/db/src/package-schema.ts"
                className="text-foreground underline underline-offset-4"
              >
                pinned to one version
              </a>
              , and a published version is never edited. A bad update can&apos;t reach you until you
              choose to move the pin, and rolling back is moving the pin to an older version.
            </TrustFact>
            <TrustFact title="A call can’t leave the site">
              API mode is{" "}
              <a
                href="https://github.com/robertn702/webmcp-today/blob/main/packages/engine/src/api-executor.ts#L161-L187"
                className="text-foreground underline underline-offset-4"
              >
                locked to the package&apos;s own origin
              </a>
              , checked when it&apos;s published and again when it runs. Your session on one site
              stays there.
            </TrustFact>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild variant="outline" className="h-11 gap-2 px-5 text-[0.95rem]">
              <a
                href="https://github.com/robertn702/webmcp-today"
                aria-label="Read the source on GitHub"
                title="Read the source on GitHub"
              >
                <SiGithub className="size-5" aria-hidden="true" />
                Read the source
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
              Go from no tools to a live result.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The quickstart gives you copyable setup commands and one prompt that walks you through
              the Reddit install, lists its tools, and calls one.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Button
              asChild
              className="h-11 gap-2 bg-brand px-5 text-[0.95rem] text-brand-contrast hover:bg-brand/90"
            >
              <Link href="/docs/quickstart">
                Make your first tool call
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 gap-2 px-5 text-[0.95rem]">
              <Link href="/submit">
                Publish a package
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- hire me */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-5xl grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-5 gap-y-3 px-4 py-5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:gap-y-0 sm:py-6">
          <div className="row-span-2" aria-hidden>
            <div className="cafe-rocketman-hover relative h-15 w-7">
              <Image
                src="https://www.robertniimi.com/space-suit-200.png"
                alt=""
                className="relative z-10 h-10 w-auto object-contain"
                height={128}
                width={83}
              />
              <Image
                src="https://www.robertniimi.com/flame.gif"
                alt=""
                className="absolute top-8 left-0 z-0 h-6 w-6 rotate-180 opacity-90"
                height={26}
                width={26}
                unoptimized
              />
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.16em] text-brand uppercase">Hire me</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Robert Niimi is a full-stack engineer and former founder with 10+ years of experience,
              exploring front-end and product engineering roles, based in NYC.
            </p>
          </div>
          <a
            href="https://www.robertniimi.com"
            rel="noreferrer"
            target="_blank"
            className="col-start-2 inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground sm:col-start-auto"
          >
            See Robert&apos;s work
            <ArrowRight data-icon="inline-end" className="size-4" />
          </a>
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

function TrustFact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-brand/30 pl-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function RunStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="font-mono text-[11px] tracking-[0.18em] text-brand uppercase">Step {number}</p>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
