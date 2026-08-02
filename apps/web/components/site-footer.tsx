import Link from "next/link";

// Rendered once by the root layout so every page carries the two links the
// project is obliged to show: the terms a submission is accepted under, and the
// source offer AGPL section 13 wants network users to get.
// TODO(extension): swap /extension for the Chrome Web Store listing once the
// extension is published (also EXTENSION_HREF in app/page.tsx).
const SOURCE_HREF = "https://github.com/robertn702/webmcp-today";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8">
        <p className="font-mono text-xs text-muted-foreground">
          ⚡ webmcp.today · a public beta registry of WebMCP packages.
        </p>
        <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <Link href="/packages" className="hover:text-foreground hover:underline">
            Browse
          </Link>
          <Link href="/submit" className="hover:text-foreground hover:underline">
            Submit
          </Link>
          <Link href="/docs" className="hover:text-foreground hover:underline">
            Docs
          </Link>
          <Link href="/extension" className="hover:text-foreground hover:underline">
            Extension
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
          <a href={SOURCE_HREF} className="hover:text-foreground hover:underline">
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
