import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_NAV_LINKS, isPathAdminOnly, type NavLink, type NavLinkInput } from "@/lib/models/nav-links";

// This app's own collection (no legacy collision — the old Angular app's
// nav was hardcoded in its own template, never admin-editable). See
// /admin/content/navigation.
const COLLECTION = "navLinks";

// cache(): the header and the page guard both read this in the same request.
export const getNavLinks = cache(async (): Promise<NavLink[]> => {
  const snapshot = await adminDb.collection(COLLECTION).get();
  if (snapshot.empty) {
    return DEFAULT_NAV_LINKS.map((link, index) => ({
      id: `default-${index}`,
      order: index,
      adminOnly: false,
      ...link,
    }));
  }
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label: typeof data.label === "string" ? data.label : "",
        href: typeof data.href === "string" ? data.href : "",
        order: typeof data.order === "number" ? data.order : 0,
        adminOnly: data.adminOnly === true,
      };
    })
    .sort((a, b) => a.order - b.order);
});

// Bulk replace: the admin form edits the whole list at once (add/remove/
// reorder/rename in one save), so this deletes every existing link and
// writes the new set fresh rather than diffing — simpler and correct for a
// list this small.
export async function setNavLinks(links: NavLinkInput[], updatedBy: string): Promise<void> {
  const existing = await adminDb.collection(COLLECTION).get();
  const batch = adminDb.batch();

  existing.docs.forEach((doc) => batch.delete(doc.ref));
  links.forEach((link, index) => {
    const ref = adminDb.collection(COLLECTION).doc();
    batch.set(ref, {
      label: link.label,
      href: link.href,
      adminOnly: link.adminOnly === true,
      order: index,
      updatedBy,
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
}

/** Non-throwing form of requireNavAccess, for Route Handlers. */
export async function canAccessPath(pathname: string): Promise<boolean> {
  const links = await getNavLinks();
  if (!isPathAdminOnly(pathname, links)) return true;
  return (await getOptionalSession())?.role === "admin";
}

/**
 * Page guard for the public site: if an "Admin only" nav link covers this
 * path, only admins may see the page. A signed-out visitor is sent to log in
 * and brought back (an admin who simply isn't logged in yet); a signed-in
 * non-admin gets a plain 404, as if the page didn't exist.
 *
 * Call it from each public page itself (not just a layout) — layouts don't
 * re-run on client-side navigation, so a layout-only check can be skipped.
 */
export async function requireNavAccess(pathname: string): Promise<void> {
  const links = await getNavLinks();
  if (!isPathAdminOnly(pathname, links)) return;

  const session = await getOptionalSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(pathname)}`);
  if (session.role !== "admin") notFound();
}
