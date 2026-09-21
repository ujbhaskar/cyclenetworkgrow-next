import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { EventCard } from "@/lib/models/event";
import { getEventRegisteredRiders } from "@/lib/events";
import { normalizeIndianState } from "@/lib/india-states";
import { normalizeCity, cleanPhone } from "@/lib/registration-normalize";
import { toNumber } from "@/lib/legacy-activity";
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
  type DailyProgressCell,
  type DailyProgressRider,
  type EventDailyProgressData,
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
  DailyProgressCell,
  DailyProgressRider,
  EventDailyProgressData,
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
  trainer?: boolean;
};

// Rules §6(a)/(d): every 25km earns 1 point, and an indoor (virtual or
// trainer-flagged) ride earns only 75% of that — e.g. a 120km outdoor ride
// is floor(120/25)=4 points, the same ride indoors is 3 points. Matches the
// rules PDF's own worked examples exactly (36km->1/0.75, 155km->6/4.50,
// 605km->24/18.00).
function pointsForRide(distanceKm: number, isVirtual: boolean): number {
  const base = Math.floor(distanceKm / 25);
  return isVirtual ? base * 0.75 : base;
}

// India Standard Time, UTC+5:30 — this is an India-run event, so "same day"
// means the same IST calendar day, not the same UTC one (a ride starting
// at 2026-09-20T19:00Z is already 2026-09-21 00:30 IST). Same reasoning as
// aw80d.ts's eventWindowBounds.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Rules §6(b)/(c), verified against the legacy Angular app's own live 1177
// leaderboard (letscng-ui's cng11772024.component.ts
// calculateExtraPoints/checkStreakPoints, confirmed still shipping in the
// 1177-2026 route): +1 bonus point per complete run of 7 consecutive
// qualifying days (non-overlapping — an 11-day run is floor(11/7)=1, not
// two overlapping windows), plus +7 more if a single run reaches 77 days.
// Both bonuses are additive on top of Distance Points, same as legacy.
function streakBonusForRun(streakDays: number): number {
  let points = Math.floor(streakDays / 7);
  if (streakDays >= 77) {
    points += 7;
  }
  return points;
}

function streakBonusPoints(dayKeys: string[]): number {
  const sorted = [...new Set(dayKeys)].sort();
  if (sorted.length === 0) {
    return 0;
  }
  let bonus = 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / ONE_DAY_MS;
    if (diffDays === 1) {
      streak += 1;
    } else {
      bonus += streakBonusForRun(streak);
      streak = 1;
    }
  }
  bonus += streakBonusForRun(streak);
  return bonus;
}

// 1177 rules §5(f)-(h) and §8(b): multiple rides on the same day are never
// combined — only that day's single longest ride counts at all, and only
// once (it can't also be "broken into" smaller counted pieces). Keeps the
// max-distance ride per IST day and drops every other same-day ride
// entirely, before bracket assignment — so two 25km+ rides on one day can
// never award two separate bracket credits or sum their distance.
function dedupeToLongestRidePerDay(rides: QualifyingRide[]): QualifyingRide[] {
  const byDay = new Map<string, QualifyingRide>();
  rides.forEach((ride) => {
    const key = istDayKey(ride.startDate);
    const existing = byDay.get(key);
    if (!existing || ride.distanceKm > existing.distanceKm) {
      byDay.set(key, ride);
    }
  });
  return [...byDay.values()];
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

    const isVirtual = activity.type === "VirtualRide" || Boolean(activity.trainer);

    rides.push({
      activityId,
      distanceKm,
      elevationM: toNumber(activity.total_elevation_gain),
      type: activity.type,
      startDate: activity.start_date as string,
      bracket: null,
      isVirtual,
      points: pointsForRide(distanceKm, isVirtual),
    });
  });

  return assignBrackets(dedupeToLongestRidePerDay(rides));
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
// millisecond. Both bounds are shifted by IST_OFFSET_MS for the same reason
// istDayKey() above is — startDate/endDate are bare "YYYY-MM-DD" values
// meaning an India calendar date, and `new Date(...)` alone parses those as
// UTC midnight (5:30am IST). Left uncorrected, a real ride from the first
// ~5.5 hours of the event's actual (IST) start date fell in a gap: too late
// for trial mode (which turns off once `now` passes the raw UTC instant)
// but before the raw-UTC `officialStart` the strict window required — see
// aw80d.ts's eventWindowBounds, which already applies this same shift.
function eventWindowMs(startDate: string, endDate: string): { start: number; end: number } {
  const officialStart = new Date(startDate).getTime() - IST_OFFSET_MS;
  const officialEnd = new Date(endDate).getTime() - IST_OFFSET_MS + ONE_DAY_MS - 1;
  const start = Date.now() < officialStart ? officialStart - TRIAL_LOOKBACK_MS : officialStart;
  return { start, end: officialEnd };
}

async function computeEventLeaderboard(event: EventCard, limit: number): Promise<EventLeaderboardData> {
  const { start, end } = eventWindowMs(event.startDate, event.endDate);

  const [ridesSnapshot, ridersSnapshot, tokensSnapshot, usersSnapshot, registeredRiders] = await Promise.all([
    adminDb.collection(RIDES_COLLECTION).get(),
    adminDb.collection(RIDERS_COLLECTION).get(),
    adminDb.collection(ATHLETE_TOKENS_COLLECTION).get(),
    adminDb.collection("users").get(),
    getEventRegisteredRiders(event.id),
  ]);

  // City/state/photo: lowest priority first (this event's own registration
  // data, so even a registrant with no `riders`/`athelete_tokens` entry at
  // all still gets *something*), then the legacy `riders` collection, then
  // athelete_tokens (most complete/reliable of the Strava-derived sources,
  // and the only one with a profile photo) — each loop below overwrites the
  // previous. `users` is last/highest priority for city/state specifically:
  // it's the one place a rider can actually go update their own address
  // (My Profile), so an edit there should show up on the leaderboard
  // without needing a fresh Strava sync or registration re-import.
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
  usersSnapshot.docs.forEach((doc) => {
    const data = doc.data() as { phone?: string | null; city?: string | null; state?: string | null };
    if (!data.phone) {
      return;
    }
    const phone = cleanPhone(data.phone);
    if (data.city) {
      cityByPhone.set(phone, normalizeCity(data.city));
    }
    const state = normalizeIndianState(data.state);
    if (state) {
      stateByPhone.set(phone, state);
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
    const totalsByDay: Record<string, DailyProgressCell> = {};
    let totalDistanceKm = 0;
    let distancePoints = 0;
    rides.forEach((ride) => {
      if (ride.bracket !== null) {
        milestoneCounts[ride.bracket] += 1;
      }
      totalDistanceKm += ride.distanceKm;
      distancePoints += ride.points;
      totalsByDay[istDayKey(ride.startDate)] = { distanceKm: ride.distanceKm, activityId: ride.activityId };

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
    // substitute for the longer-distance requirements. This "qualified"
    // status is entirely separate from points/ranking below — matches the
    // legacy app exactly, where the milestone badge and the points ranking
    // never feed into each other.
    const isFinisher = MILESTONES_KM.every((milestone) => milestoneAchieved[milestone]);

    const bonusPoints = streakBonusPoints(rides.map((ride) => istDayKey(ride.startDate)));
    const totalPoints = distancePoints + bonusPoints;

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
      distancePoints,
      bonusPoints,
      totalPoints,
      totalsByDay,
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
      distancePoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      totalsByDay: {},
    });
  });

  // Rules §6(e) — ranked by points (Distance Points + Consistency/Endurance
  // bonuses), tiebroken by total qualifying km, then name. Verified against
  // the legacy Angular app's own live 1177 leaderboard sort
  // (cng11772024.component.ts: `a.points == b.points ? b.total - a.total :
  // b.points - a.points`) — deliberately NOT prioritizing isFinisher/the
  // milestone quota badge, which legacy also keeps as a separate 🏆
  // indicator that doesn't affect rank.
  metrics.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) {
      return b.totalPoints - a.totalPoints;
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

// One tag for the entire computed leaderboard (rides + riders +
// athelete_tokens + users + the event's registered-riders snapshot, all
// folded into one result) — every write path that touches any of those
// (the Strava webhook, admin ride tools, registration sync, Strava
// connect/disconnect, a rider's own profile edit) calls
// invalidateEventLeaderboardCache() so the change shows up on the next
// request instead of waiting out CACHE_REVALIDATE_SECONDS below. That TTL
// is purely a safety net for any write path this list missed — it's not
// the primary way this cache is meant to go fresh.
const LEADERBOARD_CACHE_TAG = "event-leaderboard";
const CACHE_REVALIDATE_SECONDS = 60 * 60; // 1 hour

/**
 * Rider leaderboard for one event — buckets each rider's real Strava-synced
 * rides (within the event's date window, excluding flagged/cheat-flagged
 * activities and anything not tagged Ride/VirtualRide) into the distance
 * brackets in MILESTONES_KM, matching the qualifying-ride counting scheme
 * described in docs/REQUIREMENTS.md §3.2/§3.4.
 *
 * Cached (see LEADERBOARD_CACHE_TAG above) rather than recomputed from a
 * full scan of the `rides` collection (~15k activities) on every page
 * view — event.startDate/endDate/targetDistanceKm are included in the
 * cache key precisely so an admin edit to those fields is naturally a
 * cache miss, with no separate invalidation call needed for that case.
 */
export async function getEventLeaderboard(event: EventCard, limit = 500): Promise<EventLeaderboardData> {
  const getCached = unstable_cache(
    () => computeEventLeaderboard(event, limit),
    [event.id, event.startDate, event.endDate, String(event.targetDistanceKm), String(limit)],
    { tags: [LEADERBOARD_CACHE_TAG], revalidate: CACHE_REVALIDATE_SECONDS },
  );
  return getCached();
}

/**
 * Call from any write path that changes data getEventLeaderboard reads —
 * see the collection list on LEADERBOARD_CACHE_TAG above. `{ expire: 0 }`
 * (rather than the `"max"` stale-while-revalidate profile) because the
 * whole point here is that a rider's own action — a new ride, an edited
 * profile — shows up immediately, not "eventually, once someone else's
 * request happens to trigger a background refresh."
 */
export function invalidateEventLeaderboardCache(): void {
  revalidateTag(LEADERBOARD_CACHE_TAG, { expire: 0 });
}

// Every IST calendar day from startDateOnly through endDateOnly inclusive
// (both bare "YYYY-MM-DD", as event.startDate/endDate are) — a plain
// calendar-day walk, not a timestamp shift, since these two are already
// the IST dates themselves rather than UTC instants that need correcting
// (contrast istMidnight() in events.ts, which converts the other
// direction — a calendar date into the UTC instant of its IST midnight).
function enumerateDaysInclusive(startDateOnly: string, endDateOnly: string): string[] {
  const days: string[] = [];
  let cursor = new Date(`${startDateOnly}T00:00:00Z`).getTime();
  const endMs = new Date(`${endDateOnly}T00:00:00Z`).getTime();
  while (cursor <= endMs) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += ONE_DAY_MS;
  }
  return days;
}

/**
 * Reshapes getEventLeaderboard's already-computed riders into the 1177
 * event's "Daily Progress" matrix (rider × IST-day instead of rider ×
 * milestone-bracket) — a pure, synchronous transform of data already in
 * memory (each RiderMetric's totalsByDay), not a second pass over
 * Firestore's `rides` collection. Call this with the same
 * EventLeaderboardData already fetched for the leaderboard tab.
 */
export function buildEventDailyProgress(
  leaderboardRiders: RiderMetric[],
  eventStartDate: string,
  eventEndDate: string,
): EventDailyProgressData {
  const todayIst = istDayKey(new Date().toISOString());
  const days = enumerateDaysInclusive(eventStartDate, eventEndDate).filter((day) => day <= todayIst);

  const riders: DailyProgressRider[] = leaderboardRiders
    .filter((rider) => rider.totalRides > 0)
    .map((rider) => ({
      phone: rider.phone,
      name: rider.name,
      totalsByDay: rider.totalsByDay,
      totalDistanceKm: rider.totalDistanceKm,
    }))
    .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm || a.name.localeCompare(b.name));

  // Newest first, matching how riders actually want to check "did I ride
  // today/yesterday" without scrolling past the whole event's history.
  return { days: [...days].reverse(), riders };
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
