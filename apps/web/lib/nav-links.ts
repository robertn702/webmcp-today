export type NavLink = {
  href: string;
  label: string;
};

// Shared between the desktop header links (app/layout.tsx) and the mobile
// sheet menu (components/mobile-nav.tsx) so the two never drift.
// Docs points straight at the only docs page there is; give it a /docs index
// before adding a second one, or the header link lands on a 404.
export const NAV_LINKS: NavLink[] = [
  { href: "/packages", label: "Browse" },
  { href: "/submit", label: "Submit" },
  { href: "/docs/package-format", label: "Docs" },
  { href: "/extension", label: "Extension" },
];

// Shared by desktop + mobile navs so both highlight the same route.
export function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
