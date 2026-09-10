import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Testimonial, TestimonialStatus } from "@/lib/models/testimonial";

// This app's own collection — already carved out in firestore.rules (a
// rider can create their own pending doc; only Admin SDK can change
// `status`). Not a legacy collection, safe name, matches
// docs/ARCHITECTURE.md §8.3.
const COLLECTION = "testimonials";
const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic — matches the real (misspelled) collection name

function toTestimonial(doc: FirebaseFirestore.QueryDocumentSnapshot): Testimonial {
  const data = doc.data();
  return {
    id: doc.id,
    quote: data.quote,
    title: data.title ?? null,
    photoUrl: data.photoUrl ?? null,
    submittedBy: data.submittedBy,
    submittedByName: data.submittedByName,
    submittedAt: data.submittedAt,
    status: data.status,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: data.reviewedAt ?? null,
  };
}

// Legacy phone numbers (from `riders`/`athelete_tokens`) are stored without
// a consistent country code, while this app's own `users.phone` is
// normalized to "+91XXXXXXXXXX" (see src/lib/auth/phone.ts) — so an exact
// match won't work. Comparing the last 10 digits sidesteps that; this is
// only used to opportunistically attach a nicer avatar, never anything
// security-sensitive, so an approximate match is an acceptable trade-off.
function phoneSuffix(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

async function resolveStravaPhotoByPhone(phone: string): Promise<string | null> {
  const suffix = phoneSuffix(phone);
  if (suffix.length < 10) {
    return null;
  }
  const snapshot = await adminDb.collection(ATHLETE_TOKENS_COLLECTION).get();
  for (const doc of snapshot.docs) {
    const athlete = doc.data().athlete;
    if (athlete?.phone && phoneSuffix(String(athlete.phone)) === suffix) {
      return athlete.profile_medium ?? null;
    }
  }
  return null;
}

export async function submitTestimonial(input: {
  uid: string;
  submittedByName: string;
  phone: string | null;
  quote: string;
  title: string | null;
}): Promise<void> {
  const photoUrl = input.phone ? await resolveStravaPhotoByPhone(input.phone).catch(() => null) : null;

  await adminDb.collection(COLLECTION).add({
    quote: input.quote,
    title: input.title,
    photoUrl,
    submittedBy: input.uid,
    submittedByName: input.submittedByName,
    submittedAt: new Date().toISOString(),
    status: "pending" satisfies TestimonialStatus,
    reviewedBy: null,
    reviewedAt: null,
  });
}

// Filters with `where` only (no `orderBy` on a different field) and sorts
// in JS instead — avoids needing a composite Firestore index (verified: the
// equivalent `.orderBy()` query throws FAILED_PRECONDITION without one).
// Fine at this collection's size; revisit if it grows large.
export async function getApprovedTestimonials(limit = 12): Promise<Testimonial[]> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("status", "==", "approved" satisfies TestimonialStatus)
    .get();
  return snapshot.docs
    .map(toTestimonial)
    .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""))
    .slice(0, limit);
}

export async function getPendingTestimonials(): Promise<Testimonial[]> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("status", "==", "pending" satisfies TestimonialStatus)
    .get();
  return snapshot.docs.map(toTestimonial).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

// Every review regardless of status, most recently submitted first — the
// admin moderation page's full list view (as opposed to just the pending
// queue getPendingTestimonials returns).
export async function getAllTestimonials(): Promise<Testimonial[]> {
  const snapshot = await adminDb.collection(COLLECTION).get();
  return snapshot.docs.map(toTestimonial).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function reviewTestimonial(
  id: string,
  status: Extract<TestimonialStatus, "approved" | "discarded">,
  reviewedBy: string,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).update({
    status,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
  });
}

// A real delete (not a status change) — for admins clearing out spam/test
// submissions rather than just marking them discarded.
export async function deleteTestimonial(id: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).delete();
}
