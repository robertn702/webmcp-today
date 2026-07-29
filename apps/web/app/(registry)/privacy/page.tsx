import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What the WebMCP Today extension and website store, what they send, and what they never see.",
};

// NOTE(legal): unreviewed draft, same status as /terms. No contact mailbox
// exists yet — contact is the public issue tracker (see the terms page TODO).
const LAST_UPDATED = "28 July 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Privacy</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">What we can&apos;t see.</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        One page covers both halves of this project: the webmcp.today website and the companion
        Chrome extension. The extension is the more interesting half, and the short version is that
        it tells us almost nothing.
      </p>

      <Section n={1} title="The extension">
        <p>
          The extension stores your installed tool packages, the revocation (safety) list, and the
          known-domains list in on-device browser storage only — <code>chrome.storage.local</code>,
          never <code>chrome.storage.sync</code>, so nothing leaves your device through Chrome sync
          either.
        </p>
        <p>
          Loading a page with the extension installed makes no network requests. Every URL is
          matched locally against that on-device storage.
        </p>
        <p>The only contact with webmcp.today is:</p>
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>
            anonymous GET requests when you install a package, to download its definition from the
            registry, and
          </li>
          <li>
            periodic fetches of the global revocation list and the known-domains list, so packages
            reported as broken or abusive get disabled on your device.
          </li>
        </ul>
        <p>
          Those requests carry no account, no identifier, no cookies, and no browsing data. The
          extension has no analytics, no telemetry, and no error reporting.
        </p>
        <p>
          When an AI agent runs one of your installed tools on a page, the request goes from the
          page to that same site, using your own existing session with it. The data goes from the
          site to itself — never to us. We cannot see which sites you visit or which tools you run.
        </p>
      </Section>

      <Section n={2} title="The website">
        <p>
          Sign-in is GitHub OAuth or email and password. The site stores the profile GitHub hands
          over (name, email, avatar) and your session.
        </p>
        <p>
          Publishing a package stores the package itself and its association with your account.
          Published packages are public and offered to everyone under CC0 — see{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-4">
            the terms
          </Link>{" "}
          for what that means. Installing a package records an install row on your account, which is
          how the site serves you your pinned versions.
        </p>
        <p>The service runs on three processors:</p>
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>Vercel — hosting</li>
          <li>Neon — database</li>
          <li>Sentry — error monitoring on the web app only (not in the extension)</li>
        </ul>
      </Section>

      <Section n={3} title="What we don't collect">
        <p>
          No browsing history, no page contents, no per-URL activity from the extension. Personal
          data is not sold or shared with anyone beyond the processors listed above.
        </p>
      </Section>

      <Section n={4} title="Changes">
        <p>
          The date at the top is the version you&apos;re reading, and every edit is visible in the
          repository&apos;s public history. If the extension&apos;s behavior ever changes in a way
          this page doesn&apos;t cover, this page changes first.
        </p>
      </Section>

      <Section n={5} title="Contact">
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
