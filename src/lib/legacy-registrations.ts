import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getSheetRows } from "@/lib/googleSheets";
import { EVENTS_COLLECTION } from "@/lib/events";
import type { EventDoc } from "@/lib/models/event";
import { normalizeIndianState } from "@/lib/india-states";

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

// Matches the legacy admin panel's exact AdminService.cleanPhone: strip
// everything but digits, keep the last 10 — the bare-digit, no-country-code
// format both `events/{id}.riders` and `athelete_tokens.athlete.phone`
// already use.
function cleanPhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

function titleCase(trimmed: string): string {
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Same casing problem as city/state/gender, applied to the name itself
// ("NISHANT PATEL" / "prasenjit Dey" / "vinod chetule") — title-cased so
// names display in one consistent pattern.
function normalizeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed ? titleCase(trimmed) : "";
}

// Free-text city entries vary wildly in casing across both the
// registration sheet and Strava profiles ("KOLKATA" / "kolkata" /
// "Kolkata") — title-case them so the same city always aggregates as one
// value instead of fragmenting into 2-3 near-duplicates in any city-based
// stat. Doesn't fix genuine spelling variants (e.g. "Bombay" vs "Mumbai"),
// only case.
// Exported for rider-metrics.ts's leaderboard, which pulls city from
// sources this sync doesn't touch too (Strava's own athlete.city is never
// normalized, and rows synced before this normalization existed) — same
// casing fix applied defensively at display time, not just at sync time.
export function normalizeCity(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed ? titleCase(trimmed) : "";
}

// Same idea as normalizeCity, but state has a real canonical-name mapping
// already (abbreviations like "WB"/"TN", not just casing) — see
// src/lib/india-states.ts. Falls back to a trimmed/case-collapsed version
// of the raw value for anything the alias table doesn't recognize (a
// non-Indian entry, say), rather than silently dropping real data.
function normalizeState(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return normalizeIndianState(trimmed) ?? trimmed;
}

// Registration-sheet gender is free text ("Male"/"MALE"/"male"/"M" all seen
// in real data) and Strava's own athlete.sex is a bare "M"/"F" — same
// male/female recognition the legacy Angular admin's own getGender used
// (OnlineEventAddUserComponent), just case-insensitive and also applied to
// the sheet's values, which the legacy admin never actually normalized.
// Anything else (blank, "Other", etc.) is title-cased rather than dropped.
function normalizeGender(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (lower === "m" || lower === "male") {
    return "Male";
  }
  if (lower === "f" || lower === "female") {
    return "Female";
  }
  return titleCase(trimmed);
}

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

  return {
    sheetName,
    totalRows: rows.length,
    capturedRows: captured.length,
    uniqueRegistrations: registrations.length,
    matchedWithStrava,
  };
}
