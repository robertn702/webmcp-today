import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms for using WebMCP Today, including the license you grant when you publish a tool package and the CC0 license every published package is offered under.",
};

// TODO(legal): reviewed by a lawyer before launch. Known gaps: no governing-law
// or dispute clause, and the only contact channel is the public issue tracker
// (no abuse/legal mailbox exists yet — see docs/BACKLOG.md "Email service").
const LAST_UPDATED = "25 July 2026";

export default function TermsPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">
        Terms of service
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">What you&apos;re agreeing to</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Using webmcp.today, its API, or its extension means you accept these terms. Section 3 is the
        one to read closely. It covers what happens to a package once you publish it.
      </p>

      <div className="mt-8 border-l-2 border-brand/30 pl-5">
        <h2 className="text-sm font-semibold">The short version</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>Publishing a package gives this project a permanent license to host and share it.</li>
          <li>Every published package is offered to everyone under CC0.</li>
          <li>Nobody reviews packages. Read one before you install it.</li>
          <li>Anything here can be removed at any time.</li>
        </ul>
      </div>

      <Section n={1} title="What this is">
        <p>
          WebMCP Today is a registry of tool packages written by the public. A package is a JSON
          document that tells a browser extension how to register tools on a site the package&apos;s
          author doesn&apos;t control. Robert Niimi runs the registry. It isn&apos;t affiliated
          with, endorsed by, or operated with the involvement of any site a package targets.
        </p>
        <p>
          There is no review queue. A package goes live the moment it validates against the schema.
        </p>
      </Section>

      <Section n={2} title="Your account">
        <p>
          You need an account to publish or install. Anything done with your account, or with an API
          key created under it, is your responsibility. Treat a key like a password and delete it at{" "}
          <Link href="/settings/security" className="text-foreground underline underline-offset-4">
            Settings → Security
          </Link>{" "}
          if it leaks.
        </p>
        <p>You have to be old enough to agree to a contract where you live.</p>
      </Section>

      <Section n={3} title="What you grant when you publish">
        <p>
          Publish a package, through the form or by POSTing to the API, and you grant Robert Niimi a
          worldwide, non-exclusive, irrevocable, perpetual, royalty-free license to host, store,
          reproduce, modify, adapt, publish, distribute, and redistribute it, and to sublicense all
          of that to anyone using the registry. In practice that means the extension, the MCP
          server, the public API, and anyone reading the API directly.
        </p>
        <p>
          You keep your copyright. This is a license, not a handover. Your own work stays yours to
          use anywhere else, under any terms you like.
        </p>
        <p>
          Irrevocable matters here. Versions are append-only and every install pins to a specific
          version, so anyone who installed your package is already running a copy you can&apos;t
          call back. You can have a package taken down from the registry (section 7), but the
          license on copies already distributed stands.
        </p>
      </Section>

      <Section n={4} title="What you're promising">
        <p>When you publish, you are stating all of the following.</p>
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>The package is yours to publish. You wrote it, or you otherwise have the rights.</li>
          <li>
            It doesn&apos;t infringe anyone&apos;s copyright, trademark, patent, or other rights.
          </li>
          <li>
            It contains no credentials, API keys, tokens, or private data belonging to anyone,
            including you.
          </li>
          <li>
            No employment agreement or other contract you&apos;re under prohibits publishing it.
          </li>
        </ul>
        <p>
          If one of those turns out to be false and defending it costs this project money, that cost
          is yours.
        </p>
      </Section>

      <Section n={5} title="Published packages are CC0">
        <p>
          By publishing, you agree that your package is offered to everyone under{" "}
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/"
            className="text-foreground underline underline-offset-4"
          >
            CC0 1.0
          </a>
          . That is as close to the public domain as a license gets. Anyone can copy a package,
          change it, ship it inside a commercial product, and owe nothing, attribution included.
        </p>
        <p>
          This is deliberate. A package is a small JSON document injected into a live page, and it
          exists to be copied.
        </p>
        <p>
          The code that runs the registry is licensed separately, and split across the repository.
          The{" "}
          <a
            href="https://github.com/robertn702/webmcp-today#license"
            className="text-foreground underline underline-offset-4"
          >
            README
          </a>{" "}
          says which part is under which license.
        </p>
      </Section>

      <Section n={6} title="What you can't publish">
        <p>This list exists so there&apos;s no argument later.</p>
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>
            Packages that attack the site they target or the person running them. That includes
            harvesting credentials, sending page data somewhere the user didn&apos;t ask for, and
            writes the tool description doesn&apos;t admit to.
          </li>
          <li>Anything illegal, or built to help someone else do something illegal.</li>
          <li>
            Spam, packages published to bury a rival, or packages published to sit on a domain name.
          </li>
          <li>Malware of any description, including a harmless v1 followed by a hostile v2.</li>
        </ul>
        <p>
          The same list covers the API. Don&apos;t hammer it either. Reads are unauthenticated
          today, and that can change.
        </p>
      </Section>

      <Section n={7} title="Removing things">
        <p>
          Anything here can be removed at any time, without notice, and an account can be suspended
          the same way. The usual reasons are the list above, a credible legal complaint, or a
          package that turns out to be dangerous to the people who installed it.
        </p>
        <p>
          You can ask for your own package to be removed and it will be. Removal doesn&apos;t undo
          section 3 or section 5. Copies already distributed stay licensed, and anyone pinned to a
          version keeps running it until they move the pin.
        </p>
        <p>
          To report a package or ask for a takedown,{" "}
          <a
            href="https://github.com/robertn702/webmcp-today/issues"
            className="text-foreground underline underline-offset-4"
          >
            open an issue on the repository
          </a>
          . Include a link to the package and enough detail to act on.
        </p>
      </Section>

      <Section n={8} title="No warranty">
        <p>
          The registry, the API, and the extension are provided as they are, with no warranty of any
          kind.
        </p>
        <p>
          Packages are written by strangers and nothing checks them before they go live. A package
          registers tools on pages you&apos;re signed into, so read the tools listed on its page
          before you install it. If a package breaks a site, loses your data, gets your account
          limited, or does something you didn&apos;t expect, that is the risk you took by installing
          it.
        </p>
        <p>Uptime is not promised. This project is pre-launch and could stop existing.</p>
      </Section>

      <Section n={9} title="Liability">
        <p>
          To the fullest extent the law allows, Robert Niimi is not liable for indirect, incidental,
          or consequential damages arising from this registry, a package published on it, or the
          extension. Where liability can&apos;t be excluded, the total is capped at 100 USD or what
          you have paid to use the service, whichever is greater. Today you pay nothing to use it.
        </p>
      </Section>

      <Section n={10} title="Changes to these terms">
        <p>
          These terms will change, especially before launch. The date at the top is the version
          you&apos;re reading, and every edit to it is visible in the repository&apos;s public
          history. Using the site after a change means you accept the terms as they stand.
        </p>
      </Section>

      <Section n={11} title="Contact">
        <p>
          <a
            href="https://github.com/robertn702/webmcp-today/issues"
            className="text-foreground underline underline-offset-4"
          >
            Open an issue on the repository
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">
        <span className="mr-2 font-mono text-sm text-brand">{n}</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
