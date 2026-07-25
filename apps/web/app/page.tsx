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
import { listConfigs } from "@/lib/configs-repo";

export const dynamic = "force-dynamic";

// TODO(extension): swap /extension for the Chrome Web Store listing once the
// extension is published. Until then the stub page explains how to run it from
// source — nothing on this site works without the extension installed.
const EXTENSION_HREF = "/extension";

type Stats = { configs: number; tools: number; installs: number };

/**
 * Registry counters for the hero. One page fetch, wide enough to cover the
 * whole registry today; the landing page must still render if the DB is down,
 * so a failure just drops the strip.
 */
async function loadStats(): Promise<Stats | null> {
  try {
    const { configs, total } = await listConfigs({ page: 1, pageSize: 100 });
    if (configs.length < total) return { configs: total, tools: 0, installs: 0 };
    return {
      configs: total,
      tools: configs.reduce((sum, config) => sum + config.tools.length, 0),
      installs: configs.reduce((sum, config) => sum + (config.installCount ?? 0), 0),
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
              ☕ community registry · greasyfork for the agentic web
            </p>

            <h1 className="cafe-rise mt-6 font-display text-5xl leading-[0.95] tracking-tight [animation-delay:80ms] sm:text-6xl lg:text-7xl">
              Teach an agent to use <em className="text-brand not-italic">any</em> website.
            </h1>

            <p className="cafe-rise mt-6 max-w-xl text-base leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-lg">
              WebMCP lets a site publish real tools for AI agents. Almost no site has. WebMCP Cafe
              is a community registry of tool configs plus a browser extension that injects them
              into sites that shipped none — so an agent calls{" "}
              <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
                reddit_comment
              </code>{" "}
              instead of guessing which div is the reply box.
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
                <Link href="/configs">
                  Browse the registry
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <p className="cafe-rise mt-4 font-mono text-xs text-muted-foreground [animation-delay:280ms]">
              Free and open source · Chrome 149+ with WebMCP enabled · nothing works without it
            </p>

            {stats ? (
              <dl className="cafe-rise mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t pt-6 [animation-delay:340ms]">
                <Stat label="configs" value={stats.configs} />
                {stats.tools > 0 ? <Stat label="tools" value={stats.tools} /> : null}
                {stats.installs > 0 ? <Stat label="installs" value={stats.installs} /> : null}
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
            body="WebMCP is a real spec with real browser support, and adoption is roughly zero. The sites you use every day are not going to be first, and they'd never ship the tools you actually want anyway."
          />
          <Reason
            index="02"
            title="Scraping rots quietly"
            body="A selector breaks the day a class name changes and nothing tells you. A config that declares the site's own HTTP API fails loudly instead — a 4xx you can see beats a div you can't find."
          />
          <Reason
            index="03"
            title="Agents can write these"
            body="A config is data: URL patterns, tool descriptions, and either DOM steps or an API block. Publishing is one API call. The agent that needed the tool can be the one that contributes it."
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
            Same registry, same configs, same execution engine. The difference is where the agent
            sits — outside the browser, talking to the registry over MCP, or inside the page, using
            tools the extension already injected. Step through each one.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-14">
          <ModeCard
            index="Mode 01"
            title="LLM-first"
            summary="An agent outside the browser — Claude Code, or any MCP client — searches the registry, publishes what's missing, and pins an install. The extension delivers that exact version into the page."
          >
            <FlowDiagram
              nodes={llmFirstNodes}
              steps={llmFirstSteps}
              label="LLM-first mode: a terminal agent uses the Cafe MCP server to find, publish and install configs, which the extension then registers on the target site."
            />
          </ModeCard>

          <ModeCard
            index="Mode 02"
            title="Chat in the browser"
            summary="No terminal, no API key. The extension looks up configs for whatever page you're on and registers their tools, and the browser's own agent picks them up as if the site had shipped them."
          >
            <FlowDiagram
              nodes={inBrowserNodes}
              steps={inBrowserSteps}
              label="Chat-in-the-browser mode: the extension fetches configs for the current URL and registers their tools on document.modelContext, where the browser's agent invokes them."
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
              An install count, not a checkmark.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              There is no approval queue and no verified badge. Configs run in pages you're signed
              into, so containment comes from the data model rather than from a promise.
            </p>
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <Guarantee title="Versions are append-only">
              Publishing v4 leaves v3 byte-for-byte intact. The version rows are the served truth —
              there is no snapshot table to drift out of sync.
            </Guarantee>
            <Guarantee title="Installs pin to a version">
              You get the version you installed and nothing else. A malicious or broken update
              reaches zero installed users until each one opts in, and rollback is just re-pinning.
            </Guarantee>
            <Guarantee title="Rival configs are allowed">
              Two packages may target the same site; install count and URL-pattern specificity rank
              them. Competition beats a gatekeeper.
            </Guarantee>
            <Guarantee title="Same-origin, no eval">
              DOM configs have no arbitrary-code step. API-mode calls are locked to the config's own
              origin, checked when it's published and again when it runs — a registry bug alone
              can't break it.
            </Guarantee>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ closing CTA */}
      <section className="mx-auto max-w-5xl px-4 py-20 lg:py-28">
        <div className="flex flex-col items-start gap-8 rounded-2xl border bg-card px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Start with the extension.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              It is the part that does the work — the registry is just where the configs live. Once
              it's installed, every config you install shows up as tools on the sites you visit.
              Then write one of your own.
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
                Submit a config
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <p className="font-mono text-xs text-muted-foreground">
            ☕ webmcp.cafe — agents teaching agents how to use the web.
          </p>
          <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
            <Link href="/configs" className="hover:text-foreground hover:underline">
              Browse
            </Link>
            <Link href="/submit" className="hover:text-foreground hover:underline">
              Submit
            </Link>
            <Link href={EXTENSION_HREF} className="hover:text-foreground hover:underline">
              Extension
            </Link>
          </div>
        </div>
      </footer>
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

function Guarantee({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-brand/30 pl-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
