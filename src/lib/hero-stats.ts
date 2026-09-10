import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { HeroStat, HeroStatInput } from "@/lib/models/hero-stats";

// This app's own collection (verified no legacy collision) — a fully
// admin-authored list of home page hero stat tiles. See
// /admin/content/home-sections and docs/ARCHITECTURE.md's collection-naming
// caution about checking for legacy name collisions first.
const COLLECTION = "heroStats";

export async function getHeroStats(): Promise<HeroStat[]> {
  const snapshot = await adminDb.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label: typeof data.label === "string" ? data.label : "",
        value: typeof data.value === "string" ? data.value : "",
        order: typeof data.order === "number" ? data.order : 0,
      };
    })
    .sort((a, b) => a.order - b.order);
}

// Bulk replace: the admin form edits the whole list at once (add/remove/
// reorder/rename in one save), so this deletes every existing tile and
// writes the new set fresh rather than diffing — simpler and correct for a
// list this small.
export async function setHeroStats(stats: HeroStatInput[], updatedBy: string): Promise<void> {
  const existing = await adminDb.collection(COLLECTION).get();
  const batch = adminDb.batch();

  existing.docs.forEach((doc) => batch.delete(doc.ref));
  stats.forEach((stat, index) => {
    const ref = adminDb.collection(COLLECTION).doc();
    batch.set(ref, {
      label: stat.label,
      value: stat.value,
      order: index,
      updatedBy,
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
}
