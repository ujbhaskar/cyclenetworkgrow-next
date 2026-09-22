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

/**
 * Rebuilds one legacy event's `riders` map from its configured registration
 * sheet (`registeredGoogleDataXLS`), cross-referencing each phone against
 * every Strava-connected rider on the platform for their athlete id/profile/
 * tokens — mirrors the legacy Angular admin's "Sync users from
 * registrations" button (OnlineEventAddUserComponent.addUsersToEvent)
 * exactly, including its behavior of REPLACING the whole `riders` map
 * rather than merging into it. That means a rider added some other way
 * (e.g. manually, outside the registration sheet) would be wiped out by a
 * resync — not guarded against here on purpose, to match the existing
 * workflow rather than silently changing it.
 */
export async function syncEventRegistrationsFromSheet(eventId: string): Promise<RegistrationSyncResult> {
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

  const riders: Record<string, unknown> = {};
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

  await docRef.update({ riders });
  invalidateEventLeaderboardCache();

  return {
    sheetName,
    totalRows: rows.length,
    capturedRows: captured.length,
    uniqueRegistrations: registrations.length,
    matchedWithStrava,
  };
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
