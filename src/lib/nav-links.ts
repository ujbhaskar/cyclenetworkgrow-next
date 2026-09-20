import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_NAV_LINKS, type NavLink, type NavLinkInput } from "@/lib/models/nav-links";

// This app's own collection (no legacy collision — the old Angular app's
// nav was hardcoded in its own template, never admin-editable). See
// /admin/content/navigation.
const COLLECTION = "navLinks";

export async function getNavLinks(): Promise<NavLink[]> {
  const snapshot = await adminDb.collection(COLLECTION).get();
  if (snapshot.empty) {
    return DEFAULT_NAV_LINKS.map((link, index) => ({ id: `default-${index}`, order: index, ...link }));
  }
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label: typeof data.label === "string" ? data.label : "",
        href: typeof data.href === "string" ? data.href : "",
        order: typeof data.order === "number" ? data.order : 0,
      };
    })
    .sort((a, b) => a.order - b.order);
}

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
      order: index,
      updatedBy,
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
}
