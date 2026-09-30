import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { EVENTS_COLLECTION, type EventRider } from "@/lib/events";
import type { EventDoc } from "@/lib/models/event";
import { normalizeState } from "@/lib/india-states";
import { cleanPhone, normalizeName, normalizeCity, normalizeGender } from "@/lib/registration-normalize";
import { invalidateEventLeaderboardCache } from "@/lib/rider-metrics";
import { fetchCapturedRazorpayPayments, type RazorpayCapturedPayment } from "@/lib/razorpay";

// Reads registrations directly from Razorpay's Payments API instead of a
// manually-exported Google Sheet (see legacy-registrations.ts for that
// path) — for events whose registration payment page collects the rider's
// name/gender/city/state as custom fields (Razorpay's own `notes` object
// on each captured payment), confirmed against real production data.

export type RazorpayRegistrationPreview = {
  capturedPayments: number;
  uniqueRegistrations: number;
  existingRiderCount: number;
  newRiders: EventRider[];
};

// No two events run at overlapping times (confirmed with the admin) — so a
// generous fixed lookback before the event's own start date is safe: it
// can't reach back into a *different* event's own registration window.
// Riders can still register up through "now" (the event may be live).
const REGISTRATION_LOOKBACK_DAYS = 90;

async function getEventRidersOrThrow(eventId: string): Promise<{
  docRef: FirebaseFirestore.DocumentReference;
  data: EventDoc;
  existingRiders: Record<string, EventRider>;
}> {
  const docRef = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new Error("Event not found");
  }
  const data = doc.data() as EventDoc;
  const existingRiders = (data.riders as Record<string, EventRider> | undefined) ?? {};
  return { docRef, data, existingRiders };
}

function registrationWindow(event: EventDoc): { fromUnix: number; toUnix: number } {
  const eventStart = event.startDate ? new Date(event.startDate) : new Date();
  const from = new Date(eventStart.getTime() - REGISTRATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return { fromUnix: Math.floor(from.getTime() / 1000), toUnix: Math.floor(Date.now() / 1000) };
}

/**
 * One captured payment -> one rider record. Oldest-first so a rider's
 * FIRST captured payment wins on a duplicate phone (e.g. a retried
 * payment) — same "first occurrence wins" rule buildRidersFromSheet uses
 * for the Google Sheet path.
 */
function dedupedRidersFromPayments(payments: RazorpayCapturedPayment[]): Record<string, EventRider> {
  const riders: Record<string, EventRider> = {};
  const sorted = [...payments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const payment of sorted) {
    const phone = cleanPhone(payment.contact ?? "");
    if (!phone || riders[phone]) continue;
    riders[phone] = {
      phone,
      full_name: normalizeName(payment.notes.full_name ?? ""),
      gender: normalizeGender(payment.notes.gender ?? ""),
      city: normalizeCity(payment.notes.city ?? ""),
      state: normalizeState(payment.notes.state ?? ""),
      stravaId: "",
      profile: "",
    };
  }
  return riders;
}

/**
 * Diffs this event's captured Razorpay payments against its CURRENT riders
 * map — read-only, no write. Riders already registered (including any
 * manual correction via updateEventRiderByAdmin) are left untouched;
 * see addRazorpayRegistrations for the confirm step.
 */
export async function previewRazorpayRegistrations(eventId: string): Promise<RazorpayRegistrationPreview> {
  const { data, existingRiders } = await getEventRidersOrThrow(eventId);
  const { fromUnix, toUnix } = registrationWindow(data);
  const payments = await fetchCapturedRazorpayPayments(fromUnix, toUnix);
  const riders = dedupedRidersFromPayments(payments);

  const newRiders = Object.values(riders)
    .filter((rider) => !existingRiders[rider.phone])
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return {
    capturedPayments: payments.length,
    uniqueRegistrations: Object.keys(riders).length,
    existingRiderCount: Object.keys(existingRiders).length,
    newRiders,
  };
}

/**
 * Adds exactly the given phones' Razorpay-sourced registrations —
 * re-fetches fresh from Razorpay rather than trusting the client, same
 * pattern as addNewRiderRegistrations (the Google Sheet equivalent).
 */
export async function addRazorpayRegistrations(eventId: string, phones: string[]): Promise<{ added: number }> {
  const { docRef, data, existingRiders } = await getEventRidersOrThrow(eventId);
  const { fromUnix, toUnix } = registrationWindow(data);
  const payments = await fetchCapturedRazorpayPayments(fromUnix, toUnix);
  const riders = dedupedRidersFromPayments(payments);

  const requested = new Set(phones.map((phone) => cleanPhone(phone)).filter(Boolean));
  const updates: Record<string, EventRider> = {};
  Object.values(riders).forEach((rider) => {
    if (requested.has(rider.phone) && !existingRiders[rider.phone]) {
      updates[`riders.${rider.phone}`] = rider;
    }
  });

  const added = Object.keys(updates).length;
  if (added > 0) {
    await docRef.update(updates);
    invalidateEventLeaderboardCache();
  }

  return { added };
}
