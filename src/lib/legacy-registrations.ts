import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getSheetRows } from "@/lib/googleSheets";
import { EVENTS_COLLECTION, type EventRider } from "@/lib/events";
import type { EventDoc } from "@/lib/models/event";
import { normalizeState } from "@/lib/india-states";
import { cleanPhone, normalizeName, normalizeCity, normalizeGender } from "@/lib/registration-normalize";
import { invalidateEventLeaderboardCache } from "@/lib/rider-metrics";

// Same (misspelled) collection name src/lib/strava.ts and rider-metrics.ts
// already use — every rider who's ever connected Strava on the platform,
// keyed by Strava athlete id.
const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic

type AthleteTokenDoc = {
  access_token?: string;
  refresh_token?: string;
  athlete?: {
    id?: number | string;
    phone?: string;
    profile?: string;
    city?: string;
    state?: string;
    sex?: string;
  };
};

export type RegistrationSyncResult = {
  sheetName: string;
  totalRows: number;
  capturedRows: number;
  uniqueRegistrations: number;
  matchedWithStrava: number;
};

export type NewRiderPreview = RegistrationSyncResult & {
  /** How many riders are already registered for this event, before adding anything. */
  existingRiderCount: number;
  /** Sheet registrations not already present in the event's riders map, by phone. */
  newRiders: EventRider[];
};

// The actual Firestore-bound shape for a synced registration — a superset
// of the public EventRider (adds the Strava access/refresh tokens the
// legacy schema stores inline on each rider entry). Never send this raw
// shape to the browser; see toPublicRider below.
type StoredEventRider = EventRider & { access_token: string; refresh_token: string };

function toPublicRider(rider: StoredEventRider): EventRider {
  return {
    phone: rider.phone,
    full_name: rider.full_name,
    gender: rider.gender,
    city: rider.city,
    state: rider.state,
    stravaId: rider.stravaId,
    profile: rider.profile,
  };
}

/**
 * Reads the sheet and rebuilds every registration as a StoredEventRider,
 * cross-referencing each phone against every Strava-connected rider on the
 * platform for their athlete id/profile/tokens — the shared computation
 * behind both previewNewRiderRegistrations and addNewRiderRegistrations.
 * Read-only: never touches Firestore's `events` doc.
 */
async function buildRidersFromSheet(sheetName: string): Promise<{
  rows: Record<string, string>[];
  captured: Record<string, string>[];
  riders: Record<string, StoredEventRider>;
  matchedWithStrava: number;
}> {
  const rows = await getSheetRows(sheetName);
  const captured = rows.filter((row) => row["payment status"] === "captured");

  const seenPhones = new Set<string>();
  const registrations: { phone: string; full_name: string; gender: string; city: string; state: string }[] = [];
  captured.forEach((row) => {
    const phone = cleanPhone(row.phone ?? "");
    // First occurrence wins on a duplicate phone — same as the legacy
    // AdminService.getUniqueRegisteredUsers.
    if (!phone || seenPhones.has(phone)) {
      return;
    }
    seenPhones.add(phone);
    registrations.push({
      phone,
      full_name: row.full_name ?? "",
      gender: row.gender ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
    });
  });

  const tokensSnapshot = await adminDb.collection(ATHLETE_TOKENS_COLLECTION).get();
  const stravaByPhone = new Map<
    string,
    {
      stravaId: string;
      profile: string;
      city: string;
      state: string;
      sex: string;
      access_token?: string;
      refresh_token?: string;
    }
  >();
  tokensSnapshot.docs.forEach((tokenDoc) => {
    const token = tokenDoc.data() as AthleteTokenDoc;
    const rawPhone = token.athlete?.phone;
    if (!rawPhone) {
      return;
    }
    stravaByPhone.set(cleanPhone(rawPhone), {
      stravaId: String(token.athlete?.id ?? ""),
      profile: token.athlete?.profile ?? "",
      city: token.athlete?.city ?? "",
      state: token.athlete?.state ?? "",
      sex: token.athlete?.sex ?? "",
      access_token: token.access_token,
      refresh_token: token.refresh_token,
    });
  });

  const riders: Record<string, StoredEventRider> = {};
  let matchedWithStrava = 0;
  registrations.forEach((registration) => {
    const strava = stravaByPhone.get(registration.phone);
    if (strava) {
      matchedWithStrava += 1;
    }
    riders[registration.phone] = {
      phone: registration.phone,
      full_name: normalizeName(registration.full_name),
      // Registration sheet wins when it has a value — Strava's profile
      // gender/city/state only fill the gap when the sheet's own field is
      // blank. Normalized so "Male"/"MALE"/"male"/"M",
      // "KOLKATA"/"kolkata"/"Kolkata", and "WB"/"West Bengal" each collapse
      // to one value for gender/city/state-based stats.
      gender: normalizeGender(registration.gender || strava?.sex || ""),
      city: normalizeCity(registration.city || strava?.city || ""),
      state: normalizeState(registration.state || strava?.state || ""),
      stravaId: strava?.stravaId ?? "",
      profile: strava?.profile ?? "",
      // Firestore's update() rejects a literal `undefined` (unlike the
      // legacy Angular app's REST-based write, which silently dropped it) —
      // default to "" like the other not-yet-Strava-connected fields above.
      access_token: strava?.access_token ?? "",
      refresh_token: strava?.refresh_token ?? "",
    };
  });

  return { rows, captured, riders, matchedWithStrava };
}

async function getEventDocOrThrow(eventId: string) {
  const docRef = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new Error("Event not found");
  }
  const data = doc.data() as EventDoc;
  const sheetName = data.registeredGoogleDataXLS;
  if (!sheetName) {
    throw new Error("This event has no registration sheet configured (registeredGoogleDataXLS)");
  }
  const existingRiders = (data.riders as Record<string, EventRider> | undefined) ?? {};
  return { docRef, sheetName, existingRiders };
}

/**
 * Diffs the registration sheet against this event's CURRENT riders map —
 * read-only, no write — so an admin can see exactly who a sync would add
 * before anything actually changes. Doesn't flag riders whose sheet data
 * differs from what's already stored (e.g. after a manual correction via
 * updateEventRiderByAdmin); only phones missing from the map entirely
 * count as "new". See addNewRiderRegistrations for the confirm step.
 */
export async function previewNewRiderRegistrations(eventId: string): Promise<NewRiderPreview> {
  const { sheetName, existingRiders } = await getEventDocOrThrow(eventId);
  const { rows, captured, riders, matchedWithStrava } = await buildRidersFromSheet(sheetName);

  const newRiders = Object.values(riders)
    .filter((rider) => !existingRiders[rider.phone])
    .map(toPublicRider)
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return {
    sheetName,
    totalRows: rows.length,
    capturedRows: captured.length,
    uniqueRegistrations: Object.keys(riders).length,
    matchedWithStrava,
    existingRiderCount: Object.keys(existingRiders).length,
    newRiders,
  };
}

/**
 * Adds exactly the given phones' sheet registrations to this event's
 * riders map — everyone else's entry (including any manual corrections
 * via updateEventRiderByAdmin) is left untouched, unlike the old
 * behavior this replaces (REPLACING the whole map every sync, matching
 * the legacy Angular admin's "Sync users from registrations" button —
 * that wiped out manual edits on every resync). Re-reads the sheet fresh
 * rather than trusting rider field values from the client — `phones` is
 * only used to select which of THIS event's already-registered-elsewhere
 * riders to admit, and re-validated against the current riders map in
 * case it changed since the preview was shown.
 */
export async function addNewRiderRegistrations(eventId: string, phones: string[]): Promise<{ added: number }> {
  const { docRef, sheetName, existingRiders } = await getEventDocOrThrow(eventId);
  const { riders } = await buildRidersFromSheet(sheetName);

  const requested = new Set(phones.map((phone) => cleanPhone(phone)).filter(Boolean));
  const updates: Record<string, StoredEventRider> = {};
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
 * Corrects one rider's registration record directly — for the typos
 * riders themselves can't easily fix (they don't have a login to a
 * registration sheet, and correcting the sheet doesn't retroactively fix
 * past syncs anyway). Only touches this one entry in the event's `riders`
 * map; unlike syncEventRegistrationsFromSheet, everyone else's entry is
 * left exactly as-is.
 *
 * Deliberately does NOT touch the separate top-level `rides/{phone}`
 * collection when phone changes — a rider's already-synced ride history
 * stays filed under their old phone number. This is a known, accepted
 * limitation (see the admin UI's own note) rather than an oversight: doing
 * that safely means merging two `rides` docs, which is a bigger, riskier
 * operation than a registration-record fix warrants on its own.
 */
export async function updateEventRiderByAdmin(
  eventId: string,
  currentPhone: string,
  fields: { full_name?: string; city?: string; state?: string; phone?: string },
): Promise<EventRider> {
  const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new Error("Event not found");
  }
  const data = doc.data() as EventDoc;
  const riders = (data.riders as Record<string, EventRider> | undefined) ?? {};
  const existing = riders[currentPhone];
  if (!existing) {
    throw new Error("Rider not found in this event's registration list");
  }

  const newPhone = fields.phone ? cleanPhone(fields.phone) : currentPhone;
  if (!newPhone) {
    throw new Error("That doesn't look like a valid phone number");
  }
  if (newPhone !== currentPhone && riders[newPhone]) {
    throw new Error("Another registered rider already has that phone number");
  }

  const updated: EventRider = {
    ...existing,
    phone: newPhone,
    full_name: fields.full_name !== undefined ? normalizeName(fields.full_name) : existing.full_name,
    city: fields.city !== undefined ? normalizeCity(fields.city) : existing.city,
    state: fields.state !== undefined ? normalizeState(fields.state) : existing.state,
  };

  // Keep the map's own key in sync with `.phone` — nothing downstream
  // (getEventRegisteredRiders, the leaderboard, the webhook's participant
  // lookup) actually reads this key, only Object.values() and the `.phone`
  // field on each value, but keeping them aligned means a rider can be
  // edited again later by this same currentPhone-lookup approach.
  if (newPhone !== currentPhone) {
    await ref.update({
      [`riders.${currentPhone}`]: FieldValue.delete(),
      [`riders.${newPhone}`]: updated,
    });
  } else {
    await ref.update({ [`riders.${currentPhone}`]: updated });
  }
  invalidateEventLeaderboardCache();

  return updated;
}
