import "server-only";
import { adminDb } from "@/lib/firebase/admin";

// Same collection rider-metrics.ts reads — one doc per rider, doc id is
// their phone number, each doc a map of activityId -> raw Strava-shaped
// activity. Plus one "lastSync" doc (a timestamp), which isn't a rider and
// is filtered out everywhere this collection is listed.
const RIDES_COLLECTION = "rides";
const NON_RIDER_DOC_IDS = new Set(["lastSync"]);
// Same two collections rider-metrics.ts cross-references for name/photo —
// "riders" (name only) is the lower-priority source, "athelete_tokens" (sic,
// name + photo) overwrites it where both have an entry, same precedence
// rider-metrics.ts already uses.
const RIDERS_COLLECTION = "riders";
const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic

// Firestore batched writes cap at 500 operations.
const BATCH_SIZE = 500;

export type RideSummary = {
  phone: string;
  rideCount: number;
  name: string | null;
  photoUrl: string | null;
};

/**
 * Every rider with a synced-rides doc, plus how many activities it holds
 * and (best-effort, since not every phone has a matching profile) their
 * name/photo — mirrors the legacy admin's "Delete rides" page (letscng-ui's
 * CleanRidesComponent, which only ever showed bare phone numbers) but with
 * enough context to actually recognize who you're about to delete. Admin
 * can bulk-remove rides once an event's data has been backed up elsewhere
 * (e.g. AW80D's curated results snapshot — see src/lib/aw80d.ts) and no
 * longer needs to stay in the live sync collection.
 */
export async function listRideSummaries(): Promise<RideSummary[]> {
  const [ridesSnapshot, ridersSnapshot, tokensSnapshot] = await Promise.all([
    adminDb.collection(RIDES_COLLECTION).get(),
    adminDb.collection(RIDERS_COLLECTION).get(),
    adminDb.collection(ATHLETE_TOKENS_COLLECTION).get(),
  ]);

  const nameByPhone = new Map<string, string>();
  const photoByPhone = new Map<string, string>();

  ridersSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.phone && data.name) {
      nameByPhone.set(String(data.phone), data.name);
    }
  });
  tokensSnapshot.docs.forEach((doc) => {
    const athlete = doc.data().athlete;
    if (!athlete?.phone) {
      return;
    }
    const phone = String(athlete.phone);
    const fullName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ");
    if (fullName) {
      nameByPhone.set(phone, fullName);
    }
    if (athlete.profile_medium || athlete.profile) {
      photoByPhone.set(phone, athlete.profile_medium ?? athlete.profile);
    }
  });

  return ridesSnapshot.docs
    .filter((doc) => !NON_RIDER_DOC_IDS.has(doc.id))
    .map((doc) => ({
      phone: doc.id,
      rideCount: Object.keys(doc.data()).length,
      name: nameByPhone.get(doc.id) ?? null,
      photoUrl: photoByPhone.get(doc.id) ?? null,
    }));
}

/** Bulk-deletes the given riders' rides docs. Irreversible — same warning
 * the legacy admin page carries: only use once the data is backed up. */
export async function deleteRides(phones: string[]): Promise<{ deleted: number }> {
  const validPhones = phones.filter((phone) => !NON_RIDER_DOC_IDS.has(phone));

  for (let i = 0; i < validPhones.length; i += BATCH_SIZE) {
    const chunk = validPhones.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();
    chunk.forEach((phone) => {
      batch.delete(adminDb.collection(RIDES_COLLECTION).doc(phone));
    });
    await batch.commit();
  }

  return { deleted: validPhones.length };
}
