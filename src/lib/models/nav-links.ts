// Main site header nav links — a fully admin-authored list (label + href,
// freely added/removed/reordered), same pattern as hero-stats.ts. No
// server-only import, so both the admin form (client component) and server
// code can import it.

export type NavLink = {
  id: string;
  label: string;
  href: string;
  order: number;
  /** Hidden from everyone but admins — and so is the page behind it (see requireNavAccess). */
  adminOnly: boolean;
};

// What a client submits when saving the whole list — id/order are assigned
// server-side from array position.
export type NavLinkInput = {
  label: string;
  href: string;
  adminOnly?: boolean;
};

// Matches the hardcoded links Header.tsx used before this was
// admin-configurable — used when no navLinks docs exist yet (fresh install)
// so the site's nav doesn't go blank.
export const DEFAULT_NAV_LINKS: NavLinkInput[] = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
];

// Does `pathname` fall under this link's href? "/" only ever matches the home
// page itself; any other link also covers everything beneath it ("/shop"
// covers "/shop/abc"), but never a lookalike ("/shopping"). Query strings and
// fragments on the link are ignored, and external (http/https) links never match.
function linkCoversPath(href: string, pathname: string): boolean {
  if (!href.startsWith("/")) return false;
  const base = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** True if any admin-only link in `links` covers this path. */
export function isPathAdminOnly(pathname: string, links: Pick<NavLink, "href" | "adminOnly">[]): boolean {
  return links.some((link) => link.adminOnly && linkCoversPath(link.href, pathname));
}
