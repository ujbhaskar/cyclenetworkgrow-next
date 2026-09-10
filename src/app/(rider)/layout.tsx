import type { ReactNode } from "react";
import { verifySession } from "@/lib/auth/dal";
import SiteChrome from "@/components/layout/SiteChrome";

export default async function RiderLayout({ children }: { children: ReactNode }) {
  // Cheap redirect for UX; the authoritative check happens per-page/action
  // via the same verifySession() call — see docs/ARCHITECTURE.md §4.
  await verifySession();

  return <SiteChrome>{children}</SiteChrome>;
}
