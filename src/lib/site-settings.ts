import "server-only";
import { adminDb } from "@/lib/firebase/admin";

// This app's own collection (never a legacy one) — small, admin-editable
// site-wide settings. See docs/ARCHITECTURE.md's collection-naming caution:
// always check for a legacy collection name collision before adding a new
// top-level collection.
const COLLECTION = "siteSettings";
const HOME_HERO_DOC = "homeHero";
const READY_TO_RIDE_BANNER_DOC = "readyToRideBanner";

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

// No default here — unlike the Hero, this section is designed to work with
// no photo at all (a flat gradient, per docs/design/screenshots/Home-5.png's
// "Ready to Ride?" banner before an admin has uploaded one).
export async function getReadyToRideBannerImageUrl(): Promise<string> {
  const doc = await adminDb.collection(COLLECTION).doc(READY_TO_RIDE_BANNER_DOC).get();
  const imageUrl = doc.data()?.imageUrl;
  return typeof imageUrl === "string" ? imageUrl : "";
}

export async function setReadyToRideBannerImageUrl(imageUrl: string, updatedBy: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(READY_TO_RIDE_BANNER_DOC).set(
    {
      imageUrl,
      updatedBy,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
