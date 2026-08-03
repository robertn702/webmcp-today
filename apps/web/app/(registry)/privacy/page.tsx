import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What the WebMCP Today extension and website store, what they send, and what they never see.",
};

const LAST_UPDATED = "3 August 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Privacy</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">What we can&apos;t see.</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        This page covers both the webmcp.today website and the companion Chrome extension. The
        extension stores everything on your device and sends us almost nothing. The details are
        below.
      </p>

      <Section n={1} title="The extension">
        <p>
          The extension stores your installed tool packages, the revocation (safety) list, and the
          known-domains list in on-device browser storage (<code>chrome.storage.local</code>). It
          never uses <code>chrome.storage.sync</code>, so nothing leaves your device through Chrome
          sync.
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
          Those requests carry no account, identifier, cookies, or browsing data. The extension has
          no analytics, telemetry, or error reporting. The one thing the requests can&apos;t hide is
          your IP address, which our hosting provider&apos;s servers see, as any web server does
          (see the processor list below).
        </p>
        <p>
          When an AI agent runs one of your installed tools on a page, the request goes from the
          page to that same site, using your own existing session with it. The data goes from the
          site to itself, never to us. We cannot see which sites you visit or which tools you run.
        </p>
      </Section>

      <Section n={2} title="The website">
        <p>
          Sign-in is GitHub OAuth or email and password. The site stores the profile GitHub hands
          over (name, email, avatar) and your session, kept alive by the only cookie the site sets.
          If you sign in with GitHub, GitHub handles that sign-in under its own privacy policy. The
          service isn&apos;t directed at children under 13, and GitHub sign-in requires you to be at
          least 13.
        </p>
        <p>
          Publishing a package stores the package itself and its association with your account.
          Published packages are public and offered to everyone under CC0. See{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-4">
            the terms
          </Link>{" "}
          for what that means. Installing a package records an install row on your account, which is
          how the site serves you your pinned versions.
        </p>
        <p>
          We store all of this to run the service for you, which is the legal basis for processing
          it. Account data is kept until you ask us to delete it.
        </p>
        <p>
          The website also uses Vercel Web Analytics to understand aggregate website traffic. It is
          cookie-free and uses anonymized data. It applies to the website&apos;s deployed hosts,
          including Vercel Preview deployments. The extension does not use it or send analytics,
          telemetry, error reports, browsing history, page contents, or per-URL activity.
        </p>
        <p>The service uses these processors:</p>
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>
            Vercel (hosting and website-only Web Analytics). Its servers log IP addresses, as any
            web server does.
          </li>
          <li>Neon (database).</li>
          <li>
            Sentry (error monitoring, web app only, not in the extension). An error report can
            include your IP address, browser, and the page that failed.
          </li>
        </ul>
        <p>
          All three are US companies, so if you&apos;re in the EU or UK your data is processed in
          the US.
        </p>
      </Section>

      <Section n={3} title="What we don't collect">
        <p>
          The extension sends us no browsing history, page contents, or per-URL activity. We do not
          sell or share your personal information. Vercel, Neon, and Sentry process website data as
          described above. GitHub handles GitHub sign-in under its own privacy policy. The extension
          sends data only as described in section 1.
        </p>
      </Section>

      <Section n={4} title="Your rights">
        <p>
          You can ask to see, correct, export, or delete the data tied to your account by emailing
          the address below. Deleting your account removes your profile, sessions, and install pins.
          Published packages are public under CC0 and stay public (see the terms).
        </p>
        <p>
          If you&apos;re in the EU or UK, you also have the right to object to processing and to
          complain to your local data protection authority.
        </p>
      </Section>

      <Section n={5} title="Changes">
        <p>
          The date at the top is the version you&apos;re reading, and every edit is visible in the
          repository&apos;s public history. Material changes also get called out at the top of this
          page. If the extension&apos;s behavior ever changes in a way this page doesn&apos;t cover,
          this page changes first.
        </p>
      </Section>

      <Section n={6} title="Contact">
        <p>
          WebMCP Today is run by one person, the maintainer of the GitHub repository, not a company.
        </p>
        <p>
          Email{" "}
          <a
            href="mailto:privacy@webmcp.today"
            className="text-foreground underline underline-offset-4"
          >
            privacy@webmcp.today
          </a>{" "}
          for anything about your data, or{" "}
          <a
            href="https://github.com/robertn702/webmcp-today/issues"
            className="text-foreground underline underline-offset-4"
          >
            open an issue on the repository
          </a>{" "}
          for anything that isn&apos;t personal.
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
