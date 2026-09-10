import "server-only";
import { decompress, type Compressed } from "compress-json";
import { adminDb } from "@/lib/firebase/admin";
import { decodeLegacyStorageUrl } from "@/lib/events";
import type { Aw80dLeaderboardData, Aw80dMedal, Aw80dRider, Aw80dTeam } from "@/lib/models/aw80d";
import type { QualifyingRide } from "@/lib/models/rider-metric";
import aw80d2026Compressed from "@/lib/data/aw80d-2026-results.json";

// AW80D 6.0 (2026) — see the event's own rules PDF, linked from its Rules
// button ("CNG AW80D 2026 Concept Note_v3_15th March.pdf"). Raw legacy
// Firestore id (no "legacy-" prefix — that's only added by the
// URL-routing layer in src/lib/events.ts).
export const AW80D_EVENT_ID = "DZjop5Od0FZb9bVIopYS";

const EVENTS_COLLECTION = "events";

const MIN_RIDE_KM = 20; // rules §6h
const TEAM_GOAL_KM = 40075; // rules §6a
const FINISHER_TARGET_KM = 1500; // rules §6c.i
const TOP_N_RIDERS_FOR_TEAM = 20; // rules §6b
const MAX_INDOOR_KM_PER_DAY = 100; // rules §7c
const MAX_ELAPSED_TO_MOVING_RATIO = 3; // rules §7d
const ELEVATION_METERS_PER_POINT = 2.5; // rules §9b
const ELEVATION_POINTS_CAP_RATIO = 1.75; // rules §9b/9c
const GOLD_POINTS = 7500; // rules §6c.ii
const SILVER_POINTS = 5000; // rules §6c.ii

type LegacyAw80dActivity = {
  id?: string | number;
  distance?: number | string;
  total_elevation_gain?: number | string;
  type?: string;
  start_date?: string;
  flagged?: boolean;
  trainer?: boolean;
  from_accepted_tag?: boolean;
  elapsed_time?: number | string;
  moving_time?: number | string;
};

// Final, admin-curated post-event results snapshot (captured 4 Sep 2026,
// well after the event's 21 Jun 2026 end date) — copied verbatim from the
// legacy Angular app's src/app/appData/aw80d/2026/results.js, decoded with
// the same "compress-json" library it loads via `window.compressJSON`.
// This is the authoritative ride data: the live `rides` Firestore
// collection keeps accumulating/retaining activities that were later
// disqualified or excluded during the event's official post-event review
// (flagged-ride/cheating penalties per §16, ATC dispute resolution, etc.),
// so it no longer matches the real final standings — confirmed by diffing
// the two: every mismatch found live Firestore with STRICTLY MORE
// activities/km than this snapshot, never fewer. Keyed by rider phone
// number -> array of raw Strava-shaped ride activities (plus one
// "lastSync" key, a timestamp, which is simply never looked up as a phone
// number).
let cachedResultsData: Record<string, LegacyAw80dActivity[]> | null = null;
function getResultsData(): Record<string, LegacyAw80dActivity[]> {
  if (!cachedResultsData) {
    cachedResultsData = decompress(aw80d2026Compressed as unknown as Compressed) as Record<string, LegacyAw80dActivity[]>;
  }
  return cachedResultsData;
}

type LegacyAw80dRiderEntry = {
  teamId?: string;
  phone?: string;
  full_name?: string;
  gender?: string;
  city?: string;
  state?: string;
  profile?: string;
  // access_token/refresh_token also exist on this doc — deliberately never
  // read here; this app only ever reads Strava data via the already-synced
  // `rides` collection, never calls the Strava API itself.
};

type LegacyAw80dTeamEntry = {
  teamId?: number | string;
  teamName?: string;
  logo?: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // "2026-04-03" — enough for a per-day grouping key
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India Standard Time, UTC+5:30
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// The event's startDate/endDate are plain "YYYY-MM-DD" strings with no
// timezone (this is an India-run event) — `new Date("2026-04-03")` parses
// that as UTC midnight, not IST midnight. Naively using that as the window
// bound silently dropped early-morning IST rides that fall late the
// previous UTC day (e.g. a ride at 2026-04-02T23:28Z is 2026-04-03 04:58
// IST — the rider's first morning of the event). Confirmed against the
// legacy production site's actual displayed totals for several riders:
// only shifting these bounds to IST calendar days reproduced its numbers
// exactly. `end` is the last millisecond of endDate's IST day (inclusive).
function eventWindowBounds(startDate: string, endDate: string): { start: number; end: number } {
  const start = new Date(startDate).getTime() - IST_OFFSET_MS;
  const end = new Date(endDate).getTime() - IST_OFFSET_MS + ONE_DAY_MS - 1;
  return { start, end };
}

// Same-shape ride record used by the leaderboard's "verify rides" modal —
// `bracket` isn't a concept here (that's 1177-specific), always null.
function toQualifyingRide(activityId: string, activity: LegacyAw80dActivity, distanceKm: number): QualifyingRide {
  return {
    activityId,
    distanceKm,
    elevationM: toNumber(activity.total_elevation_gain),
    type: activity.type ?? "Ride",
    startDate: activity.start_date ?? "",
    bracket: null,
  };
}

// Rules §6h/6i, §7a/d/e/h/j — a ride counts at all only if: at least
// 20km, within the event window, not flagged, not from an accepted tag,
// and its elapsed time isn't more than 3x its moving time (a rough proxy
// for "mostly stopped, not actually riding" per §7d). Cross-device overlap
// dedup (§7f) is a separate pass, applied after this filter — see
// dedupeOverlappingRides below.
function isQualifyingActivity(activity: LegacyAw80dActivity, start: number, end: number): boolean {
  if (activity.flagged) return false;
  if (activity.from_accepted_tag) return false;
  if (activity.type !== "Ride" && activity.type !== "VirtualRide") return false;
  const rideTime = activity.start_date ? new Date(activity.start_date).getTime() : NaN;
  if (Number.isNaN(rideTime) || rideTime < start || rideTime > end) return false;
  const distanceKm = toNumber(activity.distance) / 1000;
  if (distanceKm < MIN_RIDE_KM) return false;
  const elapsed = toNumber(activity.elapsed_time);
  const moving = toNumber(activity.moving_time);
  if (moving > 0 && elapsed > moving * MAX_ELAPSED_TO_MOVING_RATIO) return false;
  return true;
}

type RideWindow = {
  activityId: string;
  distanceKm: number;
  startMs: number;
  endMs: number;
};

// Rules §7f: when two of a rider's rides overlap in time (logged from
// multiple devices), only the longest one should count. Overlaps are
// clustered transitively (sweep over rides sorted by start time, merging
// any whose window touches the running cluster's end) rather than compared
// only pairwise, so a chain of 3+ overlapping duplicates collapses into one
// cluster; the ride with the greatest distance in each cluster survives,
// the rest are dropped entirely (no distance/elevation credit).
function dedupeOverlappingRides<T extends RideWindow>(windows: T[]): T[] {
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const kept: T[] = [];
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    kept.push(cluster.reduce((longest, ride) => (ride.distanceKm > longest.distanceKm ? ride : longest)));
    cluster = [];
    clusterEnd = -Infinity;
  };

  sorted.forEach((ride) => {
    if (cluster.length > 0 && ride.startMs >= clusterEnd) {
      flushCluster();
    }
    cluster.push(ride);
    clusterEnd = Math.max(clusterEnd, ride.endMs);
  });
  flushCluster();

  return kept;
}

// Applies the qualifying-activity filter plus the §7f overlap dedup, and
// returns the same shape both the leaderboard and the "verify rides"
// endpoint need — the one place this logic lives, so the two can't drift
// apart.
function getQualifyingRides(
  activities: LegacyAw80dActivity[],
  start: number,
  end: number,
): { rides: QualifyingRide[]; isIndoorByActivityId: Map<string, boolean> } {
  const candidates: Array<RideWindow & { activity: LegacyAw80dActivity }> = [];
  activities.forEach((activity) => {
    if (activity.id === undefined) return;
    if (!isQualifyingActivity(activity, start, end)) return;
    const activityId = String(activity.id);
    const distanceKm = toNumber(activity.distance) / 1000;
    const startMs = new Date(activity.start_date ?? "").getTime();
    const elapsedSeconds = toNumber(activity.elapsed_time);
    candidates.push({ activityId, activity, distanceKm, startMs, endMs: startMs + elapsedSeconds * 1000 });
  });

  const deduped = dedupeOverlappingRides(candidates);
  const isIndoorByActivityId = new Map<string, boolean>();
  const rides = deduped
    .map(({ activityId, activity, distanceKm }) => {
      isIndoorByActivityId.set(activityId, Boolean(activity.trainer));
      return toQualifyingRide(activityId, activity, distanceKm);
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return { rides, isIndoorByActivityId };
}

function medalFor(totalPoints: number, isFinisher: boolean): Aw80dMedal {
  if (!isFinisher) return null;
  if (totalPoints >= GOLD_POINTS) return "gold";
  if (totalPoints >= SILVER_POINTS) return "silver";
  return "bronze";
}

// Computes one rider's qualifying rides plus the derived distance/
// elevation/points totals — shared by both the leaderboard and the
// per-rider "verify rides" endpoint so they can never drift apart.
function computeRiderTotals(rides: QualifyingRide[], activitiesByPhoneMeta: Map<string, boolean>) {
  // activitiesByPhoneMeta: activityId -> isIndoor(trainer), passed in
  // alongside `rides` since QualifyingRide itself has no `trainer` field.
  const indoorKmByDay = new Map<string, number>();
  let outdoorDistanceKm = 0;
  let outdoorElevationM = 0;
  // §9c's 1.75x cap is applied per ride, then summed — not applied once
  // against the rider's aggregate distance/elevation. Confirmed against
  // the legacy production site's displayed points, which only matched
  // exactly once the cap was computed this way (an aggregate cap
  // over-credits riders with one huge-elevation outlier ride among many
  // flatter ones).
  let elevationPoints = 0;

  rides.forEach((ride) => {
    const isIndoor = activitiesByPhoneMeta.get(ride.activityId) ?? false;
    if (isIndoor) {
      const key = dayKey(ride.startDate);
      indoorKmByDay.set(key, (indoorKmByDay.get(key) ?? 0) + ride.distanceKm);
    } else {
      outdoorDistanceKm += ride.distanceKm;
      outdoorElevationM += ride.elevationM;
      const rideElevationPoints = ride.elevationM / ELEVATION_METERS_PER_POINT; // §9b
      elevationPoints += Math.min(rideElevationPoints, ride.distanceKm * ELEVATION_POINTS_CAP_RATIO); // §9c
    }
  });

  // §7c: indoor cycling capped at 100km/day — anything over that day's cap
  // doesn't count toward distance at all.
  let cappedIndoorKm = 0;
  indoorKmByDay.forEach((km) => {
    cappedIndoorKm += Math.min(km, MAX_INDOOR_KM_PER_DAY);
  });

  const totalDistanceKm = outdoorDistanceKm + cappedIndoorKm;
  const totalElevationM = outdoorElevationM; // §7b/9b — no elevation points for indoor rides

  const distancePoints = totalDistanceKm; // §9a — 1km = 1 point
  const totalPoints = distancePoints + elevationPoints;

  return { totalDistanceKm, totalElevationM, distancePoints, elevationPoints, totalPoints };
}

export async function getAw80dLeaderboard(startDate: string, endDate: string): Promise<Aw80dLeaderboardData> {
  const { start, end } = eventWindowBounds(startDate, endDate);

  const eventDoc = await adminDb.collection(EVENTS_COLLECTION).doc(AW80D_EVENT_ID).get();
  const eventData = eventDoc.data();
  const teamEntries: LegacyAw80dTeamEntry[] = Array.isArray(eventData?.teams) ? eventData.teams : [];
  const riderEntries: Record<string, LegacyAw80dRiderEntry> = eventData?.riders ?? {};

  const teamNameById = new Map<string, string>();
  const teamLogoById = new Map<string, string | null>();
  teamEntries.forEach((team) => {
    if (team.teamId === undefined) return;
    const id = String(team.teamId);
    teamNameById.set(id, team.teamName ?? `Team ${id}`);
    teamLogoById.set(id, decodeLegacyStorageUrl(team.logo));
  });

  const phones = Object.keys(riderEntries);
  const resultsData = getResultsData();

  const riders: Aw80dRider[] = [];
  const teamMembers = new Map<string, Aw80dRider[]>();

  phones.forEach((phone) => {
    const entry = riderEntries[phone];
    const teamId = entry.teamId ? String(entry.teamId) : "unknown";
    const activities = resultsData[phone] ?? [];

    const { rides: qualifyingRides, isIndoorByActivityId } = getQualifyingRides(activities, start, end);

    const totals = computeRiderTotals(qualifyingRides, isIndoorByActivityId);
    const isFinisher = totals.totalDistanceKm >= FINISHER_TARGET_KM;
    const gender = entry.gender === "Male" || entry.gender === "Female" ? entry.gender : null;

    const rider: Aw80dRider = {
      phone,
      name: entry.full_name ?? `Rider ${phone}`,
      gender,
      city: entry.city ?? null,
      state: entry.state ?? null,
      photoUrl: entry.profile ?? null,
      teamId,
      teamName: teamNameById.get(teamId) ?? "Unassigned",
      totalRides: qualifyingRides.length,
      totalDistanceKm: totals.totalDistanceKm,
      totalElevationM: totals.totalElevationM,
      distancePoints: totals.distancePoints,
      elevationPoints: totals.elevationPoints,
      totalPoints: totals.totalPoints,
      isFinisher,
      medal: medalFor(totals.totalPoints, isFinisher),
    };

    riders.push(rider);
    const list = teamMembers.get(teamId) ?? [];
    list.push(rider);
    teamMembers.set(teamId, list);
  });

  riders.sort((a, b) => b.totalPoints - a.totalPoints);

  const teams: Aw80dTeam[] = teamEntries
    .filter((team) => team.teamId !== undefined)
    .map((team) => {
      const id = String(team.teamId);
      const members = (teamMembers.get(id) ?? []).slice().sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
      const topMembers = members.slice(0, TOP_N_RIDERS_FOR_TEAM);
      const qualifyingDistanceKm = topMembers.reduce((sum, r) => sum + r.totalDistanceKm, 0);
      const totalDistanceKm = members.reduce((sum, r) => sum + r.totalDistanceKm, 0);
      return {
        teamId: id,
        teamName: teamNameById.get(id) ?? `Team ${id}`,
        logoUrl: teamLogoById.get(id) ?? null,
        memberCount: members.length,
        qualifyingDistanceKm,
        totalDistanceKm,
        qualifies: qualifyingDistanceKm >= TEAM_GOAL_KM,
      };
    })
    .sort((a, b) => b.qualifyingDistanceKm - a.qualifyingDistanceKm);

  const byDistance = [...riders].sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
  const byElevation = [...riders].sort((a, b) => b.totalElevationM - a.totalElevationM);

  return {
    teams,
    riders,
    topMaleByDistance: byDistance.filter((r) => r.gender === "Male").slice(0, 10),
    topFemaleByDistance: byDistance.filter((r) => r.gender === "Female").slice(0, 5),
    topMaleByElevation: byElevation.filter((r) => r.gender === "Male").slice(0, 10),
    topFemaleByElevation: byElevation.filter((r) => r.gender === "Female").slice(0, 5),
    finisherCount: riders.filter((r) => r.isFinisher).length,
    totalDistanceKm: riders.reduce((sum, r) => sum + r.totalDistanceKm, 0),
    totalElevationM: riders.reduce((sum, r) => sum + r.totalElevationM, 0),
    teamGoalKm: TEAM_GOAL_KM,
    finisherTargetKm: FINISHER_TARGET_KM,
  };
}

export async function getAw80dRiderRides(phone: string, startDate: string, endDate: string): Promise<QualifyingRide[]> {
  const { start, end } = eventWindowBounds(startDate, endDate);
  const activities = getResultsData()[phone] ?? [];

  return getQualifyingRides(activities, start, end).rides;
}
