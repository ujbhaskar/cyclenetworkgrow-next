import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { EventCard, EventDoc, EventInput } from "@/lib/models/event";

// The one events collection — same one the legacy Angular admin's own
// add-event/edit-event forms write to (letscng-api's eventController.js).
// This app used to keep new events in a separate "cyclingEvents"
// collection, merged at read time with these — collapsed back into one on
// 2026-09-18 (see the header comment on models/event.ts).
export const EVENTS_COLLECTION = "events";

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  "1177": "1177 Endurance",
  aw80d: "AW80D",
  "east-endurance": "East Endurance",
  "rising-star": "Rising Star",
  special: "Special",
  purchase: "Purchase",
};

// `image` and `rules` are base64-encoded Firebase Storage download URLs
// (all real docs follow this pattern) — decode defensively, since a
// malformed doc could have a plain URL or nothing at all. `payment_link`,
// by contrast, is already a plain URL (Razorpay etc.) — never
// base64-encoded, so it's used as-is, no decoding.
export function decodeLegacyStorageUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const decoded = Buffer.from(value, "base64").toString("utf-8");
    return decoded.startsWith("http") ? decoded : null;
  } catch {
    return null;
  }
}

// Same base64 encoding the legacy admin's own encodeUrl() helper uses when
// saving `image`/`rules` — the inverse of decodeLegacyStorageUrl above.
export function encodeLegacyStorageUrl(url: string): string {
  return Buffer.from(url, "utf-8").toString("base64");
}

// `distance` is inconsistently typed across real docs: plain numbers,
// "--" placeholders, and Indian-format numbers with commas (e.g.
// "3,84,400"). Never throws — returns null if it can't be parsed.
export function parseLegacyDistanceKm(distance: unknown): number | null {
  if (typeof distance === "number") {
    return distance;
  }
  if (typeof distance === "string") {
    const cleaned = distance.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    if (cleaned !== "" && !Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatDistanceLabel(km: number | null): string {
  return km === null ? "Distance TBA" : `${km.toLocaleString()} km`;
}

function mapEventCard(id: string, data: EventDoc): EventCard {
  const targetDistanceKm = parseLegacyDistanceKm(data.distance);
  return {
    id,
    slug: data.path || id,
    name: data.name ?? "Untitled Event",
    categoryLabel: EVENT_CATEGORY_LABELS[data.category ?? ""] ?? data.category ?? "Event",
    startDate: data.startDate ?? "",
    endDate: data.endDate ?? "",
    distanceLabel: formatDistanceLabel(targetDistanceKm),
    targetDistanceKm,
    typeLabel: data.eventType === "online" ? "Online" : data.eventType === "offline" ? "In-person" : "—",
    imageUrl: decodeLegacyStorageUrl(data.image),
    description: data.description ?? null,
    paymentLink: data.payment_link ?? null,
    rulesUrl: decodeLegacyStorageUrl(data.rules),
  };
}

/** Published events, unfiltered by date — getUpcomingEvents/getPastEvents
 * apply that. */
async function getPublishedEventCards(): Promise<EventCard[]> {
  const snapshot = await adminDb.collection(EVENTS_COLLECTION).where("publish", "==", true).get();
  return snapshot.docs
    .map((doc) => mapEventCard(doc.id, doc.data() as EventDoc))
    .filter((event) => event.startDate && event.endDate);
}

/** Whether an event's end date is still in the future. */
export function isEventUpcoming(event: Pick<EventCard, "endDate">): boolean {
  return new Date(event.endDate).getTime() >= Date.now();
}

/** Whether an event's start date hasn't arrived yet. */
export function isEventNotYetStarted(event: Pick<EventCard, "startDate">): boolean {
  return new Date(event.startDate).getTime() > Date.now();
}

/**
 * Upcoming events, soonest first — end date in the future. Real end date is
 * used rather than the `status` field, since `status` is inconsistently
 * maintained (several real past events have no status at all) — end date
 * is reliably populated, so it's the trustworthy signal for "is this
 * actually upcoming."
 */
export async function getUpcomingEvents(limit = 3): Promise<EventCard[]> {
  const now = Date.now();
  const cards = await getPublishedEventCards();
  return cards
    .filter((event) => new Date(event.endDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit);
}

/** Past events, most recently ended first — end date already in the past. */
export async function getPastEvents(limit = 5): Promise<EventCard[]> {
  const now = Date.now();
  const cards = await getPublishedEventCards();
  return cards
    .filter((event) => new Date(event.endDate).getTime() < now)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
    .slice(0, limit);
}

/**
 * A single event for the detail page, resolved from a URL slug
 * (EventCard.slug): either the doc's `path` field (e.g. "aw80d-6.0" — the
 * same slug the production Angular app uses at /cng-events/<path>) or the
 * doc id directly. A "legacy-<docId>" form is still accepted too, so links
 * published before the two-collection model was collapsed keep working.
 * Returns null if not found, or if the doc isn't published.
 */
export async function getEventBySlug(slug: string): Promise<EventCard | null> {
  const id = slug.startsWith("legacy-") ? slug.slice("legacy-".length) : slug;

  const doc = await adminDb.collection(EVENTS_COLLECTION).doc(id).get();
  if (doc.exists) {
    const data = doc.data() as EventDoc;
    return data.publish === true ? mapEventCard(doc.id, data) : null;
  }

  // Not a doc id — try matching on the `path` field instead.
  const snapshot = await adminDb
    .collection(EVENTS_COLLECTION)
    .where("path", "==", slug)
    .where("publish", "==", true)
    .limit(1)
    .get();
  const matched = snapshot.docs[0];
  return matched ? mapEventCard(matched.id, matched.data() as EventDoc) : null;
}

export type PublicEventRider = {
  name: string;
  gender: string | null;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
};

/**
 * Registered riders for the public event page — e.g. shown before an
 * event's real ride data exists yet (registration is open/closed but
 * riding hasn't started). Deliberately excludes phone, Strava athlete id,
 * and tokens — those live on the same `riders` map but are never meant to
 * be public, unlike the admin-facing EventRider shape.
 */
export async function getPublicEventRiders(id: string): Promise<PublicEventRider[]> {
  const doc = await adminDb.collection(EVENTS_COLLECTION).doc(id).get();
  if (!doc.exists) {
    return [];
  }
  const data = doc.data() as EventDoc;
  const riders = Object.values((data.riders as Record<string, EventRider>) ?? {});
  return riders
    .map((rider) => ({
      name: rider.full_name || "Rider",
      gender: rider.gender || null,
      city: rider.city || null,
      state: rider.state || null,
      photoUrl: rider.profile || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type EventAdminSummary = {
  id: string;
  name: string;
  path: string | null;
  categoryLabel: string;
  startDate: string;
  endDate: string;
  publish: boolean;
  eventType: string | null;
  status: string | null;
  riderCount: number;
  hasRegistrationSheet: boolean;
};

/** Every event, unfiltered by `publish` (unlike the public
 * getUpcomingEvents/getPastEvents) — admin needs to see everything,
 * including unpublished/draft ones. */
export async function listAllEventsForAdmin(): Promise<EventAdminSummary[]> {
  const snapshot = await adminDb.collection(EVENTS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as EventDoc;
      return {
        id: doc.id,
        name: data.name ?? "Untitled Event",
        path: data.path ?? null,
        categoryLabel: EVENT_CATEGORY_LABELS[data.category ?? ""] ?? data.category ?? "Event",
        startDate: data.startDate ?? "",
        endDate: data.endDate ?? "",
        publish: data.publish === true,
        eventType: data.eventType ?? null,
        status: data.status ?? null,
        riderCount: Object.keys(data.riders ?? {}).length,
        hasRegistrationSheet: Boolean(data.registeredGoogleDataXLS),
      };
    })
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export type EventRider = {
  phone: string;
  full_name?: string;
  gender?: string;
  city?: string;
  state?: string;
  stravaId?: string | number;
  profile?: string;
};

/** One event's full admin detail, including its decoded image/rules URLs
 * (for editing) and riders list (for the registration-sync sub-page). */
export async function getEventAdminDetail(
  id: string,
): Promise<(Omit<EventDoc, "riders"> & { id: string; riders: EventRider[] }) | null> {
  const doc = await adminDb.collection(EVENTS_COLLECTION).doc(id).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data() as EventDoc;
  const riders = Object.values((data.riders as Record<string, EventRider>) ?? {});
  return { ...data, id: doc.id, riders };
}

export async function listAllEvents(): Promise<Array<EventDoc & { id: string }>> {
  const snapshot = await adminDb.collection(EVENTS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as EventDoc) }))
    .sort((a, b) => new Date(b.startDate ?? "").getTime() - new Date(a.startDate ?? "").getTime());
}

export async function createEvent(input: EventInput): Promise<{ id: string }> {
  const ref = adminDb.collection(EVENTS_COLLECTION).doc();
  await ref.set(input);
  return { id: ref.id };
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(id).set(input, { merge: true });
}

export async function deleteEvent(id: string): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(id).delete();
}
