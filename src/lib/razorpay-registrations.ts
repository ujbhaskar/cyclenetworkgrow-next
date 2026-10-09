import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { EVENTS_COLLECTION, type EventRider } from "@/lib/events";
import type { EventDoc } from "@/lib/models/event";
import { normalizeState } from "@/lib/india-states";
import { cleanPhone, normalizeName, normalizeCity, normalizeGender } from "@/lib/registration-normalize";
import { invalidateEventLeaderboardCache } from "@/lib/rider-metrics";
import { buildStravaByPhone, type StravaMatch } from "@/lib/legacy-registrations";
import {
  fetchCapturedRazorpayPayments,
  fetchRazorpayPaymentPageByShortUrl,
  type RazorpayCapturedPayment,
} from "@/lib/razorpay";

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
  /** True if payments were narrowed to this event's exact registration
   * price (its payment_link matched a real Payment Page) — false means
   * only the date-range fallback applied, which is less precise. */
  scopedByExactAmount: boolean;
};

// No two events run at overlapping times (confirmed with the admin) — so a
// generous fixed lookback before the event's own start date is a safe
// *fallback* scope: it can't reach back into a different event's own
// registration window. Riders can still register up through "now" (the
// event may be live). Used on its own when payment_link doesn't resolve to
// a real Payment Page; otherwise combined with the exact-amount filter
// below for real precision, since Razorpay's API has no "payments for this
// page" endpoint (confirmed directly against real payment/order data).
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
 * Fetches this event's captured payments, narrowed to its exact
 * registration price when possible. Looks up the Payment Page matching the
 * event's own `payment_link` field (same URL the public "Join Now" button
 * uses) and, if found, filters to only payments at that page's configured
 * amount — on top of the date-range fallback, not instead of it, since a
 * lookup failure (payment_link unset, or stale/not matching any page)
 * shouldn't break the sync entirely.
 */
async function fetchScopedPayments(
  event: EventDoc,
): Promise<{ payments: RazorpayCapturedPayment[]; scopedByExactAmount: boolean }> {
  const { fromUnix, toUnix } = registrationWindow(event);
  const payments = await fetchCapturedRazorpayPayments(fromUnix, toUnix);

  if (!event.payment_link) {
    return { payments, scopedByExactAmount: false };
  }

  const page = await fetchRazorpayPaymentPageByShortUrl(event.payment_link).catch(() => null);
  if (!page || page.amount == null) {
    return { payments, scopedByExactAmount: false };
  }

  return { payments: payments.filter((p) => p.amount === page.amount), scopedByExactAmount: true };
}

/**
 * One captured payment -> one rider record. Oldest-first so a rider's
 * FIRST captured payment wins on a duplicate phone (e.g. a retried
 * payment) — same "first occurrence wins" rule buildRidersFromSheet uses
 * for the Google Sheet path.
 *
 * `stravaByPhone` cross-references every phone against Strava connections
 * already on the platform (same lookup buildRidersFromSheet uses) so a
 * rider who connected Strava before paying shows up already linked, rather
 * than needing a separate "Strava-link candidates" pass afterward.
 */
function dedupedRidersFromPayments(
  payments: RazorpayCapturedPayment[],
  stravaByPhone: Map<string, StravaMatch>,
): Record<string, EventRider> {
  const riders: Record<string, EventRider> = {};
  const sorted = [...payments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const payment of sorted) {
    const phone = cleanPhone(payment.contact ?? "");
    if (!phone || riders[phone]) continue;
    const strava = stravaByPhone.get(phone);
    riders[phone] = {
      phone,
      full_name: normalizeName(payment.notes.full_name ?? ""),
      gender: normalizeGender(payment.notes.gender ?? ""),
      city: normalizeCity(payment.notes.city ?? ""),
      state: normalizeState(payment.notes.state ?? ""),
      stravaId: strava?.stravaId ?? "",
      profile: strava?.profile ?? "",
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
  const [{ payments, scopedByExactAmount }, stravaByPhone] = await Promise.all([
    fetchScopedPayments(data),
    buildStravaByPhone(),
  ]);
  const riders = dedupedRidersFromPayments(payments, stravaByPhone);

  const newRiders = Object.values(riders)
    .filter((rider) => !existingRiders[rider.phone])
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return {
    capturedPayments: payments.length,
    uniqueRegistrations: Object.keys(riders).length,
    existingRiderCount: Object.keys(existingRiders).length,
    newRiders,
    scopedByExactAmount,
  };
}

/**
 * Adds exactly the given phones' Razorpay-sourced registrations —
 * re-fetches fresh from Razorpay rather than trusting the client, same
 * pattern as addNewRiderRegistrations (the Google Sheet equivalent).
 */
export async function addRazorpayRegistrations(eventId: string, phones: string[]): Promise<{ added: number }> {
  const { docRef, data, existingRiders } = await getEventRidersOrThrow(eventId);
  const [{ payments }, stravaByPhone] = await Promise.all([fetchScopedPayments(data), buildStravaByPhone()]);
  const riders = dedupedRidersFromPayments(payments, stravaByPhone);

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

/**
 * Address/pin each rider typed on the registration payment page, by phone
 * (first captured payment wins, as in dedupedRidersFromPayments). Not
 * stored on the event's riders map — read live from Razorpay, only for the
 * admin report's address fallback. Empty on any Razorpay failure so the
 * report still downloads, just without this fallback.
 */
export async function getRegistrationAddressesByPhone(
  eventId: string,
): Promise<Map<string, { address: string; pincode: string }>> {
  const result = new Map<string, { address: string; pincode: string }>();
  try {
    const { data } = await getEventRidersOrThrow(eventId);
    const { payments } = await fetchScopedPayments(data);
    [...payments]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((payment) => {
        const phone = cleanPhone(payment.contact ?? "");
        if (!phone || result.has(phone)) return;
        result.set(phone, {
          address: (payment.notes.address ?? "").trim(),
          pincode: (payment.notes.pincode ?? "").trim(),
        });
      });
  } catch {
    // fall through with whatever was collected
  }
  return result;
}
