import type { ReactNode } from "react";

// Shared container for every registry page (browse, submit, settings, auth).
// The landing page at `/` sits outside this group so it can go full-bleed.
export default function RegistryLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10">{children}</div>;
}
