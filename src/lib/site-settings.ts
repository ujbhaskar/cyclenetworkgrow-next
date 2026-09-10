import "server-only";
import { adminDb } from "@/lib/firebase/admin";

// This app's own collection (never a legacy one) — small, admin-editable
// site-wide settings. See docs/ARCHITECTURE.md's collection-naming caution:
// always check for a legacy collection name collision before adding a new
// top-level collection.
const COLLECTION = "siteSettings";
const HOME_HERO_DOC = "homeHero";

// Static fallback shown until an admin uploads a real banner.
export const DEFAULT_HOME_HERO_IMAGE = "/images/banners/cng_group1.webp";

export async function getHomeHeroImageUrl(): Promise<string> {
  const doc = await adminDb.collection(COLLECTION).doc(HOME_HERO_DOC).get();
  const imageUrl = doc.data()?.imageUrl;
  return typeof imageUrl === "string" && imageUrl ? imageUrl : DEFAULT_HOME_HERO_IMAGE;
}

export async function setHomeHeroImageUrl(imageUrl: string, updatedBy: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(HOME_HERO_DOC).set(
    {
      imageUrl,
      updatedBy,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
