export type NavLink = {
  href: string;
  label: string;
};

// Shared between the desktop header links (app/layout.tsx) and the mobile
// sheet menu (components/mobile-nav.tsx) so the two never drift.
export const NAV_LINKS: NavLink[] = [
  { href: "/packages", label: "Browse" },
  { href: "/submit", label: "Submit" },
  { href: "/docs", label: "Docs" },
  { href: "/extension", label: "Extension" },
];

// Shared by desktop + mobile navs so both highlight the same route.
export function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
