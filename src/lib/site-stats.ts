import "server-only";
import { adminDb } from "@/lib/firebase/admin";

// All-time, real headline numbers — NOT shown directly on the public site
// (the home page hero's stat tiles are a fully admin-authored list, see
// src/lib/hero-stats.ts). This is a reference the admin form displays
// alongside that editor, so whoever's writing tile text has real current
// numbers to copy from instead of guessing. Computed from the live
// `rides`/`riders`/`athelete_tokens`/`events` collections — read-only, same
// collections used elsewhere (see src/lib/rider-metrics.ts).
const RIDES_COLLECTION = "rides";
const RIDERS_COLLECTION = "riders";
const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic — matches the real (misspelled) collection name
const LEGACY_EVENTS_COLLECTION = "events";
const NEW_EVENTS_COLLECTION = "cyclingEvents";

export type SiteStats = {
  riderCount: number;
  totalDistanceKm: number;
  cityCount: number;
  eventCount: number;
};

// Rounds down to a clean base so a "X+" claim never overstates the real
// number (e.g. 777,889 -> 770,000, safely described as "770,000+").
function roundDownTo(value: number, base: number): number {
  return Math.floor(value / base) * base;
}

// The `city` field is free text typed into a Strava/registration profile,
// not picked from a validated list — real data has spelling variants
// ("Tiruppur"/"Tirupur"), abbreviations ("G.Noida"/"Greater Noida"), typos
// ("Ferozpur"/"Firozpur"), decorative emoji, and addresses crammed into the
// field ("Chennai, Guduvanchery"). A naive trim+lowercase count overstates
// the real number of distinct cities — this collapses the known common
// variants; residual noise this doesn't catch is why getSiteStats still
// rounds the result down further as a safety margin.
const CITY_ALIASES: Record<string, string> = {
  "new delhi": "delhi",
  gurugram: "gurgaon",
  tiruppur: "tirupur",
  "dehra dun": "dehradun",
  देहरादून: "dehradun",
  मुंबई: "mumbai",
  bengaluru: "bangalore",
  "g.noida": "noida",
  "g noida": "noida",
  gnoida: "noida",
  "gr noida": "noida",
  "greater noida": "noida",
  "greater noida west": "noida",
  "greno west": "noida",
  "noida ext": "noida",
  "noida -ncr": "noida",
  ferozpur: "ferozepur",
  firozpur: "ferozepur",
  "mira road": "mira bhayandar",
  "mira-bhayandar": "mira bhayandar",
  "mira-bhayandhar": "mira bhayandar",
  miraroad: "mira bhayandar",
  "mira bhy": "mira bhayandar",
  puducherry: "pondicherry",
};
// Non-city junk that occasionally ends up in the field.
const CITY_STOPLIST = new Set(["uk", "jh", "ghs"]);

function normalizeCity(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  let value = raw.trim().toLowerCase();
  // Strip emoji/flags/decorative symbols and combining marks.
  value = value.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{0300}-\u{036F}]/gu, "");
  // Many entries cram a locality/second city/pincode after a comma or
  // slash — the first segment is usually the actual city.
  value = value.split(/[,/]/)[0];
  value = value.replace(/[^a-zऀ-ॿ\s-]/g, "").replace(/\s+/g, " ").trim();
  value = CITY_ALIASES[value] ?? value;
  if (!value || value.length < 3 || CITY_STOPLIST.has(value)) {
    return null;
  }
  return value;
}

export async function getSiteStats(): Promise<SiteStats> {
  const [ridesSnapshot, ridersSnapshot, tokensSnapshot, legacyEventsSnapshot, newEventsSnapshot] =
    await Promise.all([
      adminDb.collection(RIDES_COLLECTION).get(),
      adminDb.collection(RIDERS_COLLECTION).get(),
      adminDb.collection(ATHLETE_TOKENS_COLLECTION).get(),
      adminDb.collection(LEGACY_EVENTS_COLLECTION).get(),
      adminDb.collection(NEW_EVENTS_COLLECTION).get(),
    ]);

  let totalDistanceM = 0;
  let riderCount = 0;
  ridesSnapshot.docs.forEach((doc) => {
    const activities = doc.data() as Record<string, { distance?: number | string; type?: string; flagged?: boolean }>;
    let hasValidRide = false;
    Object.values(activities).forEach((activity) => {
      if (activity.flagged) return;
      if (activity.type !== "Ride" && activity.type !== "VirtualRide") return;
      const distance = typeof activity.distance === "number" ? activity.distance : Number(activity.distance) || 0;
      totalDistanceM += distance;
      hasValidRide = true;
    });
    if (hasValidRide) {
      riderCount += 1;
    }
  });

  const cities = new Set<string>();
  ridersSnapshot.docs.forEach((doc) => {
    const normalized = normalizeCity(doc.data().city);
    if (normalized) {
      cities.add(normalized);
    }
  });
  tokensSnapshot.docs.forEach((doc) => {
    const normalized = normalizeCity(doc.data().athlete?.city);
    if (normalized) {
      cities.add(normalized);
    }
  });

  return {
    riderCount: roundDownTo(riderCount, 25),
    totalDistanceKm: roundDownTo(totalDistanceM / 1000, 10000),
    // Normalization above collapses the known duplicate variants, but real
    // free-text city data always has residual noise it doesn't catch —
    // round down further as a safety margin against overstating this.
    cityCount: roundDownTo(cities.size, 20),
    eventCount: legacyEventsSnapshot.size + newEventsSnapshot.size,
  };
}
