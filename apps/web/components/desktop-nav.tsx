"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavLinkActive, NAV_LINKS } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

/**
 * Inline header links for `md` and up. Client island (needs usePathname for
 * the active state) so the header in app/layout.tsx stays a server component.
 * Active = brand amber, the palette's documented "active" meaning.
 */
export function DesktopNavLinks() {
  const pathname = usePathname();

  return (
    // ml-2 widens the logo→links gap so wayfinding reads as two groups.
    <div className="ml-2 hidden items-center gap-2 md:flex">
      {NAV_LINKS.map((link) => {
        const isActive = isNavLinkActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // px-2 gives text links optical padding comparable to the icon
              // buttons beside them, keeping the header's gap-2 rhythm even.
              "px-2 py-1 text-sm hover:text-foreground hover:underline",
              isActive ? "text-brand" : "text-muted-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
