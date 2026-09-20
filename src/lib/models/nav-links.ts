// Main site header nav links — a fully admin-authored list (label + href,
// freely added/removed/reordered), same pattern as hero-stats.ts. No
// server-only import, so both the admin form (client component) and server
// code can import it.

export type NavLink = {
  id: string;
  label: string;
  href: string;
  order: number;
};

// What a client submits when saving the whole list — id/order are assigned
// server-side from array position.
export type NavLinkInput = {
  label: string;
  href: string;
};

// Matches the hardcoded links Header.tsx used before this was
// admin-configurable — used when no navLinks docs exist yet (fresh install)
// so the site's nav doesn't go blank.
export const DEFAULT_NAV_LINKS: NavLinkInput[] = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
];
