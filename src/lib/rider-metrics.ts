import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { EventCard } from "@/lib/models/event";
import { getEventRegisteredRiders } from "@/lib/events";
import { normalizeIndianState } from "@/lib/india-states";
import { normalizeCity } from "@/lib/legacy-registrations";
import {
  MILESTONES_KM,
  MILESTONE_QUOTAS,
  type MilestoneKm,
  type QualifyingRide,
  type RiderMetric,
  type LongestRide,
  type PlaceStat,
  type GenderStat,
  type EventLeaderboardData,
} from "@/lib/models/rider-metric";

// The "1177 Grand Endurance" event's doc id — shared with the event detail
// page and the Strava webhook so both agree on which event "current"
// means. Same pattern as AW80D_EVENT_ID in aw80d.ts.
export const EVENT_1177_ID = "EPVUTrG0Vvj6dspIe5Bl";

export { MILESTONES_KM, MILESTONE_QUOTAS };
export type {
  MilestoneKm,
  QualifyingRide,
  RiderMetric,
  LongestRide,
  PlaceStat,
  GenderStat,
  EventLeaderboardData,
};

// All read-only, live production collections — same rule as the events
// adapter in src/lib/events.ts: never write here. `rides` is keyed by phone
// number, each doc a map of activityId -> activity. Name/city/photo
// resolution prefers `athelete_tokens` (every Strava-connected rider has
// one, set at OAuth connect time — the more complete source, and the only
// one with a profile photo) over `riders` (a separate, often-skipped
// registration form), falling back to "Rider {phone}".
const RIDES_COLLECTION = "rides";
const RIDERS_COLLECTION = "riders";
const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic — matches the real (misspelled) collection name

type LegacyActivity = {
  distance?: number | string;
  total_elevation_gain?: number | string;
  type?: string;
  start_date?: string;
  flagged?: boolean;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

const MILESTONES_DESC = [...MILESTONES_KM].reverse() as MilestoneKm[];

// Waterfall bracket assignment: process brackets highest to lowest, filling
// each bracket's quota (in ride date order) from the rides that still
// qualify for it; whatever's left over spills down to the next bracket.
// E.g. six 200km rides against quotas {150:1, 100:3, 75:6, ...} fill 150KM
// (1), then 100KM (3), then 75KM (2) — the last, lowest bracket (25KM) has
// no cap, so anything that never qualified for a higher bracket (e.g. a
// rider who only ever did 25km rides) lands there uncapped.
function assignBrackets(rides: QualifyingRide[]): QualifyingRide[] {
  const chronological = [...rides].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const assignedBracket = new Map<string, MilestoneKm>();

  MILESTONES_DESC.forEach((milestone, index) => {
    const isLast = index === MILESTONES_DESC.length - 1;
    const quota = MILESTONE_QUOTAS[milestone];
    let filled = 0;

    for (const ride of chronological) {
      if (assignedBracket.has(ride.activityId) || ride.distanceKm < milestone) {
        continue;
      }
      assignedBracket.set(ride.activityId, milestone);
      filled += 1;
      if (!isLast && filled >= quota) {
        break;
      }
    }
  });

  return chronological.map((ride) => ({ ...ride, bracket: assignedBracket.get(ride.activityId) ?? null }));
}

// Shared qualifying-ride filter — same criteria used by both the leaderboard
// aggregate and the per-rider ride list shown in the "verify" modal, so the
// two can never drift out of sync.
function getQualifyingRides(
  activities: Record<string, LegacyActivity>,
  start: number,
  end: number,
): QualifyingRide[] {
  const smallestMilestone = MILESTONES_KM[0];
  const rides: QualifyingRide[] = [];

  Object.entries(activities).forEach(([activityId, activity]) => {
    if (activity.flagged) {
      return;
    }
    if (activity.type !== "Ride" && activity.type !== "VirtualRide") {
      return;
    }
    const rideTime = activity.start_date ? new Date(activity.start_date).getTime() : NaN;
    if (Number.isNaN(rideTime) || rideTime < start || rideTime > end) {
      return;
    }

    const distanceKm = toNumber(activity.distance) / 1000;
    if (distanceKm < smallestMilestone) {
      return;
    }

    rides.push({
      activityId,
      distanceKm,
      elevationM: toNumber(activity.total_elevation_gain),
      type: activity.type,
      startDate: activity.start_date as string,
      bracket: null,
    });
  });

  return assignBrackets(rides);
}

/**
 * Rider leaderboard for one event — buckets each rider's real Strava-synced
 * rides (within the event's date window, excluding flagged/cheat-flagged
 * activities and anything not tagged Ride/VirtualRide) into the distance
 * brackets in MILESTONES_KM, matching the qualifying-ride counting scheme
 * described in docs/REQUIREMENTS.md §3.2/§3.4. Computed on read (not a
 * synced leaderboard pipeline — that's the bigger, not-yet-built Strava
 * integration in docs/ARCHITECTURE.md §5/§6); fine for a public event page
 * at this app's data volume (~375 riders, ~15k activities total).
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Trial mode: before an event's official start, pull the window back a
// week so real rides flowing in early (webhook testing, riders starting
// ahead of time) are actually visible instead of the empty/countdown
// state — see the "trial leaderboard" banner on the event page. Once `now`
// passes the real start date this stops applying on its own, no manual
// reset needed.
const TRIAL_LOOKBACK_MS = 7 * ONE_DAY_MS;

// Shared by getEventLeaderboard and getRiderRides, so the leaderboard and
// its "verify rides" modal always agree on which activities are in-window.
// `end` is inclusive of the whole end-date day, not just its first
// millisecond.
function eventWindowMs(startDate: string, endDate: string): { start: number; end: number } {
  const officialStart = new Date(startDate).getTime();
  const start = Date.now() < officialStart ? officialStart - TRIAL_LOOKBACK_MS : officialStart;
  return { start, end: new Date(endDate).getTime() + ONE_DAY_MS - 1 };
}

export async function getEventLeaderboard(event: EventCard, limit = 500): Promise<EventLeaderboardData> {
  const { start, end } = eventWindowMs(event.startDate, event.endDate);

  const [ridesSnapshot, ridersSnapshot, tokensSnapshot, registeredRiders] = await Promise.all([
    adminDb.collection(RIDES_COLLECTION).get(),
    adminDb.collection(RIDERS_COLLECTION).get(),
    adminDb.collection(ATHLETE_TOKENS_COLLECTION).get(),
    getEventRegisteredRiders(event.id),
  ]);

  // City/state/photo: lowest priority first (this event's own registration
  // data, so even a registrant with no `riders`/`athelete_tokens` entry at
  // all still gets *something*), then the legacy `riders` collection, then
  // athelete_tokens last (most complete/reliable source, and the only one
  // with a profile photo) — each loop below overwrites the previous.
  //
  // Name is different: registration data wins there, applied last and
  // unconditionally, regardless of what Strava has on file — the admin's
  // "Current Riders" list (registration sync) is the name people expect to
  // see, and a rider's Strava display name can legitimately differ (a
  // nickname, a different transliteration, etc.) without that being wrong.
  const nameByPhone = new Map<string, string>();
  const cityByPhone = new Map<string, string>();
  const stateByPhone = new Map<string, string>();
  const photoByPhone = new Map<string, string>();
  registeredRiders.forEach((rider) => {
    if (!rider.phone) return;
    if (rider.city) cityByPhone.set(rider.phone, normalizeCity(rider.city));
    const registeredState = normalizeIndianState(rider.state);
    if (registeredState) stateByPhone.set(rider.phone, registeredState);
    if (rider.profile) photoByPhone.set(rider.phone, rider.profile);
  });
  ridersSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.phone && data.name) {
      nameByPhone.set(String(data.phone), data.name);
    }
    if (data.phone && data.city) {
      cityByPhone.set(String(data.phone), normalizeCity(String(data.city)));
    }
  });
  const sexByPhone = new Map<string, "M" | "F">();
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
    if (athlete.city) {
      cityByPhone.set(phone, normalizeCity(String(athlete.city)));
    }
    if (athlete.profile_medium) {
      photoByPhone.set(phone, athlete.profile_medium);
    }
    const state = normalizeIndianState(athlete.state);
    if (state) {
      stateByPhone.set(phone, state);
    }
    if (athlete.sex === "M" || athlete.sex === "F") {
      sexByPhone.set(phone, athlete.sex);
    }
  });
  registeredRiders.forEach((rider) => {
    if (rider.phone && rider.full_name) {
      nameByPhone.set(rider.phone, rider.full_name);
    }
  });

  const metrics: RiderMetric[] = [];
  let longestRide: LongestRide | null = null;
  let maleLongestRide: LongestRide | null = null;
  let femaleLongestRide: LongestRide | null = null;
  const cityStats = new Map<string, PlaceStat>();
  const stateStats = new Map<string, PlaceStat>();
  const bracketTotals: Record<MilestoneKm, number> = { 25: 0, 50: 0, 75: 0, 100: 0, 150: 0 };
  const genderStats: { male: GenderStat; female: GenderStat } = {
    male: { riderCount: 0, totalDistanceKm: 0 },
    female: { riderCount: 0, totalDistanceKm: 0 },
  };

  ridesSnapshot.docs.forEach((doc) => {
    const phone = doc.id;
    const activities = doc.data() as Record<string, LegacyActivity>;
    const rides = getQualifyingRides(activities, start, end);

    if (rides.length === 0) {
      return;
    }

    const name = nameByPhone.get(phone) ?? `Rider ${phone}`;
    const city = cityByPhone.get(phone) ?? null;
    const state = stateByPhone.get(phone) ?? null;
    const sex = sexByPhone.get(phone) ?? null;

    // Exclusive, not cascading: each ride counts toward only its own
    // highest qualifying bracket — a 100km ride counts as a 100KM ride, not
    // also as a 25/50/75KM ride — so a rider's bracket counts sum to their
    // total qualifying ride count.
    const milestoneCounts: Record<MilestoneKm, number> = { 25: 0, 50: 0, 75: 0, 100: 0, 150: 0 };
    let totalDistanceKm = 0;
    rides.forEach((ride) => {
      if (ride.bracket !== null) {
        milestoneCounts[ride.bracket] += 1;
      }
      totalDistanceKm += ride.distanceKm;

      if (!longestRide || ride.distanceKm > longestRide.distanceKm) {
        longestRide = {
          activityId: ride.activityId,
          riderName: name,
          city,
          distanceKm: ride.distanceKm,
          startDate: ride.startDate,
        };
      }

      if (sex === "M" && (!maleLongestRide || ride.distanceKm > maleLongestRide.distanceKm)) {
        maleLongestRide = {
          activityId: ride.activityId,
          riderName: name,
          city,
          distanceKm: ride.distanceKm,
          startDate: ride.startDate,
        };
      }
      if (sex === "F" && (!femaleLongestRide || ride.distanceKm > femaleLongestRide.distanceKm)) {
        femaleLongestRide = {
          activityId: ride.activityId,
          riderName: name,
          city,
          distanceKm: ride.distanceKm,
          startDate: ride.startDate,
        };
      }
    });

    // Per-bracket achievement — independent of the others, unlike
    // isFinisher below which requires every bracket met at once.
    const milestoneAchieved = Object.fromEntries(
      MILESTONES_KM.map((milestone) => [milestone, milestoneCounts[milestone] >= MILESTONE_QUOTAS[milestone]]),
    ) as Record<MilestoneKm, boolean>;

    // A rider has "finished" the event's full quota structure only once
    // every bracket — not just the total ride count — hits its minimum
    // (1x150 + 3x100 + 6x75 + 15x50 + 30x25); a pile of short rides can't
    // substitute for the longer-distance requirements.
    const isFinisher = MILESTONES_KM.every((milestone) => milestoneAchieved[milestone]);

    // City/state are attributed at the rider level (their home city gets
    // credit for their total distance), not per-ride.
    if (city) {
      const existing = cityStats.get(city) ?? { place: city, riderCount: 0, totalDistanceKm: 0 };
      existing.riderCount += 1;
      existing.totalDistanceKm += totalDistanceKm;
      cityStats.set(city, existing);
    }
    if (state) {
      const existing = stateStats.get(state) ?? { place: state, riderCount: 0, totalDistanceKm: 0 };
      existing.riderCount += 1;
      existing.totalDistanceKm += totalDistanceKm;
      stateStats.set(state, existing);
    }
    if (sex === "M" || sex === "F") {
      const bucket = sex === "M" ? genderStats.male : genderStats.female;
      bucket.riderCount += 1;
      bucket.totalDistanceKm += totalDistanceKm;
    }
    MILESTONES_KM.forEach((milestone) => {
      bracketTotals[milestone] += milestoneCounts[milestone];
    });

    metrics.push({
      phone,
      name,
      city,
      state,
      photoUrl: photoByPhone.get(phone) ?? null,
      milestoneCounts,
      milestoneAchieved,
      totalRides: rides.length,
      totalDistanceKm,
      isFinisher,
      progressPercent: event.targetDistanceKm
        ? Math.min(100, (totalDistanceKm / event.targetDistanceKm) * 100)
        : null,
    });
  });

  // "Qualifiers" means riders with at least one real qualifying ride —
  // captured before the zero-ride registrants below are appended, so this
  // stat doesn't just become "everyone registered".
  const totalQualifiers = metrics.length;

  // Every other registered rider still shows up on the table, just with
  // all-zero stats, instead of being invisible until their first synced
  // ride — city/state/gender aggregates above are untouched by these
  // (0 contributes nothing to a sum, and "N riders from X" should mean N
  // riders who've actually ridden, not N who signed up).
  const seenPhones = new Set(metrics.map((m) => m.phone));
  registeredRiders.forEach((rider) => {
    if (!rider.phone || seenPhones.has(rider.phone)) {
      return;
    }
    seenPhones.add(rider.phone);
    metrics.push({
      phone: rider.phone,
      name: nameByPhone.get(rider.phone) ?? rider.full_name ?? `Rider ${rider.phone}`,
      city: cityByPhone.get(rider.phone) ?? null,
      state: stateByPhone.get(rider.phone) ?? null,
      photoUrl: photoByPhone.get(rider.phone) ?? null,
      milestoneCounts: { 25: 0, 50: 0, 75: 0, 100: 0, 150: 0 },
      milestoneAchieved: { 25: false, 50: false, 75: false, 100: false, 150: false },
      totalRides: 0,
      totalDistanceKm: 0,
      isFinisher: false,
      progressPercent: event.targetDistanceKm ? 0 : null,
    });
  });

  // Riders who've completed the full quota rank above everyone else,
  // regardless of distance — being "qualified" matters more than raw
  // distance for this event's ranking. Within each group, sort by distance,
  // then name (stable tie-break — matters most for the 0-distance riders
  // above, which would otherwise sort in registration order).
  metrics.sort((a, b) => {
    if (a.isFinisher !== b.isFinisher) {
      return a.isFinisher ? -1 : 1;
    }
    if (a.totalDistanceKm !== b.totalDistanceKm) {
      return b.totalDistanceKm - a.totalDistanceKm;
    }
    return a.name.localeCompare(b.name);
  });

  const topByDistance = (stats: Map<string, PlaceStat>, count: number) =>
    [...stats.values()].sort((a, b) => b.totalDistanceKm - a.totalDistanceKm).slice(0, count);

  return {
    riders: metrics.slice(0, limit),
    totalQualifiers,
    totalDistanceKm: metrics.reduce((sum, m) => sum + m.totalDistanceKm, 0),
    totalRides: metrics.reduce((sum, m) => sum + m.totalRides, 0),
    finisherCount: metrics.filter((m) => m.isFinisher).length,
    longestRide,
    maleLongestRide,
    femaleLongestRide,
    // Full ranked lists — the UI shows a short slice with a "Show more"
    // toggle rather than the server truncating what's available.
    topCities: topByDistance(cityStats, cityStats.size),
    topStates: topByDistance(stateStats, stateStats.size),
    allStateStats: topByDistance(stateStats, stateStats.size),
    bracketTotals,
    genderStats,
  };
}

/**
 * The individual qualifying rides behind one rider's leaderboard row —
 * powers the "verify" modal so anyone can see exactly which Strava-synced
 * activities produced that rider's milestone counts and total distance.
 * Uses the same event window / qualifying-ride criteria as getEventLeaderboard.
 */
export async function getRiderRides(phone: string, eventStartDate: string, eventEndDate: string): Promise<QualifyingRide[]> {
  const { start, end } = eventWindowMs(eventStartDate, eventEndDate);
  const doc = await adminDb.collection(RIDES_COLLECTION).doc(phone).get();
  if (!doc.exists) {
    return [];
  }
  const activities = doc.data() as Record<string, LegacyActivity>;
  const rides = getQualifyingRides(activities, start, end);
  return rides.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}
