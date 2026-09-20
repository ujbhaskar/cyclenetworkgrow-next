import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import {
  ANNOUNCEMENT_VARIANTS,
  DEFAULT_SITE_ANNOUNCEMENT,
  type SiteAnnouncement,
} from "@/lib/models/site-announcement";

// This app's own collection (no legacy collision — the legacy Angular
// portal had no concept of an admin-authored home page banner). Single
// document, same "one settings doc" pattern as rideRulesConfig.
const COLLECTION = "siteAnnouncement";
const DOC_ID = "home";

export async function getSiteAnnouncement(): Promise<SiteAnnouncement> {
  const doc = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) {
    return DEFAULT_SITE_ANNOUNCEMENT;
  }
  const data = doc.data() ?? {};
  return {
    enabled: Boolean(data.enabled),
    message: typeof data.message === "string" ? data.message : DEFAULT_SITE_ANNOUNCEMENT.message,
    variant: ANNOUNCEMENT_VARIANTS.includes(data.variant) ? data.variant : DEFAULT_SITE_ANNOUNCEMENT.variant,
  };
}

export async function updateSiteAnnouncement(input: SiteAnnouncement, updatedBy: string): Promise<void> {
  await adminDb
    .collection(COLLECTION)
    .doc(DOC_ID)
    .set(
      {
        ...input,
        updatedBy,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}
