"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isNavLinkActive, NAV_LINKS } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

/**
 * Hamburger menu for viewports below `md`. Client island so the header in
 * app/layout.tsx can stay a server component.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on any navigation (e.g. back/forward, or tapping the current link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 gap-0">
        <SheetHeader>
          <SheetTitle className="font-mono text-[11px] font-normal tracking-[0.2em] text-muted-foreground uppercase">
            Menu
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 p-4 pt-0">
          {NAV_LINKS.map((link) => {
            const isActive = isNavLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-base hover:bg-accent hover:text-foreground",
                  isActive ? "font-medium text-brand" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
