import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { CyclingEvent, EventCard, EventInput } from "@/lib/models/event";

// NOT "events" — that collection name is already used by the live
// production Angular/Express app (27 real events: AW80D, East Endurance,
// CNG1177, etc., with a completely different schema: path/rules/
// configuration/payment_link/riders). Two verification docs briefly landed
// there and were deleted immediately — this collection name change is the
// actual fix. See docs/ARCHITECTURE.md's data-model notes on collection
// naming collisions with the legacy schema. Admin create/edit/delete in
// this app only ever touches THIS collection.
const COLLECTION = "cyclingEvents";

// The live production app's own collection — read-only from here, on
// purpose. Never write to this from the new app; the old Angular admin
// panel remains the only writer until/unless a real migration happens.
const LEGACY_COLLECTION = "events";

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  "1177": "1177 Endurance",
  aw80d: "AW80D",
  "east-endurance": "East Endurance",
  "rising-star": "Rising Star",
  special: "Special",
};

type LegacyEventDoc = {
  name?: string;
  description?: string;
  category?: string;
  // URL slug in the production Angular app (/cng-events/<path>), e.g.
  // "aw80d-6.0", "1177". Present on all 27 real docs.
  path?: string;
  startDate?: string;
  endDate?: string;
  distance?: string | number;
  eventType?: string;
  image?: string;
  rules?: string;
  payment_link?: string;
  publish?: boolean;
};

// Legacy `image` and `rules` are base64-encoded Firebase Storage download
// URLs (all 27 real docs follow this pattern) — decode defensively, since a
// future or malformed doc could have a plain URL or nothing at all.
// `payment_link`, by contrast, is already a plain URL (Razorpay etc.) —
// never base64-encoded, so it's used as-is, no decoding.
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

// Legacy `distance` is inconsistently typed across the 27 real docs: plain
// numbers, "--" placeholders, and Indian-format numbers with commas (e.g.
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

function mapLegacyEvent(id: string, data: LegacyEventDoc): EventCard {
  const targetDistanceKm = parseLegacyDistanceKm(data.distance);
  return {
    id: `legacy-${id}`,
    slug: data.path || `legacy-${id}`,
    name: data.name ?? "Untitled Event",
    categoryLabel: LEGACY_CATEGORY_LABELS[data.category ?? ""] ?? data.category ?? "Event",
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

function mapNewEvent(event: CyclingEvent): EventCard {
  return {
    id: event.id,
    slug: event.id,
    name: event.name,
    categoryLabel: event.category,
    startDate: event.startDate,
    endDate: event.endDate,
    distanceLabel: `${event.distanceKm} km`,
    targetDistanceKm: event.distanceKm,
    typeLabel: event.difficulty,
    imageUrl: null, // this app's own events don't have banner uploads yet
    paymentLink: null, // no payment integration built yet — see docs/REQUIREMENTS.md open questions
    rulesUrl: null, // no document-upload feature for this app's own events yet
    description: event.description || null,
  };
}

/**
 * Merges this app's own events (`cyclingEvents`, status "active") with the
 * live production app's real events (`events`, read-only, `publish ==
 * true`). Unfiltered by date — getUpcomingEvents/getPastEvents apply that.
 * Filters in memory rather than compound Firestore queries, to avoid
 * needing composite indexes; fine at this app's scale.
 */
async function getMergedEventCards(): Promise<EventCard[]> {
  const [legacySnapshot, newSnapshot] = await Promise.all([
    adminDb.collection(LEGACY_COLLECTION).where("publish", "==", true).get(),
    adminDb.collection(COLLECTION).where("status", "==", "active").get(),
  ]);

  const legacyCards = legacySnapshot.docs
    .map((doc) => mapLegacyEvent(doc.id, doc.data() as LegacyEventDoc))
    .filter((event) => event.startDate && event.endDate);

  const newCards = newSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as CyclingEvent)
    .map(mapNewEvent);

  return [...legacyCards, ...newCards];
}

/** Whether an event's end date is still in the future. */
export function isEventUpcoming(event: Pick<EventCard, "endDate">): boolean {
  return new Date(event.endDate).getTime() >= Date.now();
}

/**
 * Upcoming events, soonest first — end date in the future. Real end date is
 * used rather than a status field, since the legacy `status` field is
 * inconsistently maintained (several real past events have no status at
 * all) — end date is reliably populated across all 27 legacy docs, so it's
 * the trustworthy signal for "is this actually upcoming."
 */
export async function getUpcomingEvents(limit = 3): Promise<EventCard[]> {
  const now = Date.now();
  const cards = await getMergedEventCards();
  return cards
    .filter((event) => new Date(event.endDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit);
}

/** Past events, most recently ended first — end date already in the past. */
export async function getPastEvents(limit = 5): Promise<EventCard[]> {
  const now = Date.now();
  const cards = await getMergedEventCards();
  return cards
    .filter((event) => new Date(event.endDate).getTime() < now)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
    .slice(0, limit);
}

/**
 * A single event for the detail page, resolved from a URL slug
 * (EventCard.slug). The slug is one of:
 *  - a legacy event's `path` field (e.g. "aw80d-6.0") — the same slug the
 *    production Angular app uses at /cng-events/<path>
 *  - this app's own cyclingEvents doc id
 *  - a "legacy-<docId>" string — still accepted so older links keep working
 *    (and covers legacy docs that have no `path`)
 * Returns null if not found, or if a legacy doc exists but isn't published.
 */
export async function getEventBySlug(slug: string): Promise<EventCard | null> {
  if (slug.startsWith("legacy-")) {
    const legacyId = slug.slice("legacy-".length);
    const doc = await adminDb.collection(LEGACY_COLLECTION).doc(legacyId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as LegacyEventDoc;
    if (data.publish !== true) {
      return null;
    }
    return mapLegacyEvent(doc.id, data);
  }

  // This app's own events — doc id.
  const ownDoc = await adminDb.collection(COLLECTION).doc(slug).get();
  if (ownDoc.exists) {
    return mapNewEvent({ id: ownDoc.id, ...ownDoc.data() } as CyclingEvent);
  }

  // Legacy events — matched on the `path` field, published only.
  const legacySnapshot = await adminDb
    .collection(LEGACY_COLLECTION)
    .where("path", "==", slug)
    .where("publish", "==", true)
    .limit(1)
    .get();
  const legacyDoc = legacySnapshot.docs[0];
  if (legacyDoc) {
    return mapLegacyEvent(legacyDoc.id, legacyDoc.data() as LegacyEventDoc);
  }

  return null;
}

export async function listAllEvents(): Promise<CyclingEvent[]> {
  const snapshot = await adminDb.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as CyclingEvent)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export async function createEvent(input: EventInput, createdBy: string): Promise<CyclingEvent> {
  const ref = adminDb.collection(COLLECTION).doc();
  const event: CyclingEvent = {
    id: ref.id,
    ...input,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  await ref.set(event);
  return event;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).set(input, { merge: true });
}

export async function deleteEvent(id: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).delete();
}
