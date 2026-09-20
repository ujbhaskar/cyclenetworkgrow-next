import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import {
  ANNOUNCEMENT_VARIANTS,
  type AnnouncementVariant,
  type SiteAnnouncement,
  type SiteAnnouncementInput,
} from "@/lib/models/site-announcement";

// This app's own collection (no legacy collision — the legacy Angular
// portal had no concept of an admin-authored home page banner).
const COLLECTION = "siteAnnouncements";

// The very first version of this feature (pre-scheduling) kept a single
// on/off doc here instead of a list. One-time, self-healing migration below
// carries whatever was live there into the new list the first time this
// runs in production, so the admin's already-configured banner doesn't
// silently vanish under them when this feature shipped.
const LEGACY_COLLECTION = "siteAnnouncement";
const LEGACY_DOC_ID = "home";

function normalize(id: string, data: FirebaseFirestore.DocumentData): SiteAnnouncement {
  return {
    id,
    message: typeof data.message === "string" ? data.message : "",
    variant: (ANNOUNCEMENT_VARIANTS as readonly string[]).includes(data.variant)
      ? (data.variant as AnnouncementVariant)
      : "info",
    enabled: Boolean(data.enabled),
    startAt: typeof data.startAt === "string" ? data.startAt : "",
    endAt: typeof data.endAt === "string" ? data.endAt : "",
  };
}

async function migrateLegacySingleton(): Promise<SiteAnnouncement | null> {
  const doc = await adminDb.collection(LEGACY_COLLECTION).doc(LEGACY_DOC_ID).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data() ?? {};
  if (!data.enabled || typeof data.message !== "string" || !data.message.trim()) {
    return null;
  }

  const now = new Date();
  const input: SiteAnnouncementInput = {
    message: data.message,
    variant: (ANNOUNCEMENT_VARIANTS as readonly string[]).includes(data.variant)
      ? (data.variant as AnnouncementVariant)
      : "info",
    enabled: true,
    startAt: now.toISOString(),
    // 30 days out — long enough not to silently expire the admin's existing
    // message right after this migration runs; they can tighten it once
    // they see it in the new scheduled-list UI.
    endAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const ref = adminDb.collection(COLLECTION).doc();
  await ref.set({ ...input, updatedBy: "migration", updatedAt: now.toISOString() });
  return { id: ref.id, ...input };
}

export async function listSiteAnnouncements(): Promise<SiteAnnouncement[]> {
  const snapshot = await adminDb.collection(COLLECTION).get();
  if (snapshot.empty) {
    const migrated = await migrateLegacySingleton();
    return migrated ? [migrated] : [];
  }
  return snapshot.docs
    .map((doc) => normalize(doc.id, doc.data()))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Banners currently within their scheduled window and not manually paused
 * — what the public home page actually renders. */
export async function getActiveSiteAnnouncements(): Promise<SiteAnnouncement[]> {
  const all = await listSiteAnnouncements();
  const now = Date.now();
  return all.filter((a) => {
    if (!a.enabled || !a.message) {
      return false;
    }
    const start = new Date(a.startAt).getTime();
    const end = new Date(a.endAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
  });
}

// Bulk replace: the admin form edits the whole list at once (add/remove/
// reschedule in one save), so this deletes every existing banner and
// writes the new set fresh rather than diffing — simpler and correct for a
// list this small.
export async function setSiteAnnouncements(announcements: SiteAnnouncementInput[], updatedBy: string): Promise<void> {
  const existing = await adminDb.collection(COLLECTION).get();
  const batch = adminDb.batch();

  existing.docs.forEach((doc) => batch.delete(doc.ref));
  announcements.forEach((announcement) => {
    const ref = adminDb.collection(COLLECTION).doc();
    batch.set(ref, {
      ...announcement,
      updatedBy,
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
}
