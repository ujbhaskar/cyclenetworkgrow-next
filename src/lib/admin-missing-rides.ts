import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { listStravaConnections } from "@/lib/strava";
import { findStravaTokenDocByPhone, findStravaTokenDocById, getValidStravaAccessToken } from "@/lib/strava-tokens";
import { invalidateEventLeaderboardCache } from "@/lib/rider-metrics";

// Same collection src/lib/admin-rides.ts and rider-metrics.ts already use.
const RIDES_COLLECTION = "rides";

const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

export type RiderSearchResult = {
  athleteId: string;
  name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  profileImageUrl: string | null;
};

export type RiderSearchFilters = {
  /** Case-insensitive substring match over first+last name. */
  name?: string;
  /** Case-insensitive substring match over the rider's resolved city. */
  location?: string;
  /** Exact match against the rider's resolved state (a dropdown value, not free text). */
  state?: string;
};

/**
 * Search over every Strava-connected rider by name/location/state, any
 * combination — lets an admin find the right person to pull missing rides
 * for without already knowing their phone or Strava athlete id. Reuses
 * listStravaConnections (same data the "Strava-Connected Riders" admin page
 * shows) and filters in memory — fine at this app's rider-count scale (see
 * rider-metrics.ts's own note on data volume), and Firestore has no
 * case-insensitive substring query anyway. Requires at least one filter, so
 * this never accidentally dumps the entire rider list.
 */
export async function searchRiders(filters: RiderSearchFilters): Promise<RiderSearchResult[]> {
  const name = filters.name?.trim().toLowerCase() ?? "";
  const location = filters.location?.trim().toLowerCase() ?? "";
  const state = filters.state?.trim() ?? "";
  if (!name && !location && !state) {
    return [];
  }
  const connections = await listStravaConnections();
  return connections
    .filter((connection) => {
      if (name && !`${connection.firstName ?? ""} ${connection.lastName ?? ""}`.toLowerCase().includes(name)) {
        return false;
      }
      if (location && !(connection.resolvedCity ?? "").toLowerCase().includes(location)) {
        return false;
      }
      if (state && connection.resolvedState !== state) {
        return false;
      }
      return true;
    })
    .slice(0, 20)
    .map((connection) => ({
      athleteId: connection.athleteId,
      name: [connection.firstName, connection.lastName].filter(Boolean).join(" ") || "(no name on file)",
      phone: connection.phone,
      city: connection.resolvedCity,
      state: connection.resolvedState,
      profileImageUrl: connection.profileImageUrl,
    }));
}

type RawStravaActivity = {
  id: number;
  name: string;
  distance: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  manual: boolean;
  flagged?: boolean;
  from_accepted_tag?: boolean;
  trainer?: boolean;
  average_speed?: number;
  elapsed_time?: number;
  moving_time?: number;
  external_id?: string;
};

// Carries every field the eventual rides/{phone} write needs, so the client
// can hold the exact selected activities in state between the fetch and
// sync steps without a second round trip to Strava.
export type CandidateActivity = {
  id: string;
  name: string;
  distanceKm: number;
  elevationM: number;
  type: string;
  startDate: string;
  flagged: boolean;
  trainer: boolean;
  manual: boolean;
  fromAcceptedTag: boolean;
  averageSpeed: number;
  elapsedTime: number;
  movingTime: number;
  externalId: string;
};

/**
 * Fetches one rider's recent Strava activities and filters to the same
 * candidate-ride criteria the legacy admin's "Pull Missing Rides" page used
 * (PullMissingRidesComponent.filterRides): Ride/VirtualRide, not manual,
 * not from a tagged activity, at least minDistanceKm. A preview step —
 * nothing is written yet, see syncActivitiesToRides. Looked up by phone or
 * by Strava athlete id — whichever the admin has on hand — exactly one of
 * `identifier.phone`/`identifier.athleteId` should be set.
 */
export async function fetchCandidateRides(
  identifier: { phone?: string; athleteId?: string },
  minDistanceKm: number,
  afterDate: string,
): Promise<{ athleteId: string; phone: string; activities: CandidateActivity[] }> {
  const found = identifier.athleteId
    ? await findStravaTokenDocById(identifier.athleteId)
    : identifier.phone
      ? await findStravaTokenDocByPhone(identifier.phone)
      : null;
  if (!found) {
    throw new Error("This rider hasn't connected Strava.");
  }
  const phone = found.data.athlete?.phone;
  if (!phone) {
    throw new Error("This Strava connection has no phone number on file.");
  }
  const accessToken = await getValidStravaAccessToken(found.athleteId, found.data);

  const afterEpoch = Math.floor(new Date(afterDate).getTime() / 1000);
  const res = await fetch(`${STRAVA_ACTIVITIES_URL}?after=${afterEpoch}&per_page=80`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activities fetch failed: ${res.status} ${await res.text()}`);
  }
  const raw = (await res.json()) as RawStravaActivity[];

  const activities = raw
    .filter(
      (activity) =>
        Number(activity.distance) > minDistanceKm * 1000 &&
        activity.manual === false &&
        (activity.type === "Ride" || activity.type === "VirtualRide") &&
        activity.from_accepted_tag !== true,
    )
    .map(
      (activity): CandidateActivity => ({
        id: String(activity.id),
        name: activity.name,
        distanceKm: activity.distance / 1000,
        elevationM: activity.total_elevation_gain,
        type: activity.type,
        startDate: activity.start_date,
        flagged: Boolean(activity.flagged),
        trainer: Boolean(activity.trainer),
        manual: activity.manual,
        fromAcceptedTag: Boolean(activity.from_accepted_tag),
        averageSpeed: activity.average_speed ?? 0,
        elapsedTime: activity.elapsed_time ?? 0,
        movingTime: activity.moving_time ?? 0,
        externalId: activity.external_id ?? "",
      }),
    );

  return { athleteId: found.athleteId, phone, activities };
}

/**
 * Writes the given (already-fetched, admin-selected) activities into
 * rides/{phone} — additively merges with whatever's already there,
 * matching the legacy admin's exact write (Firestore `.set(data, {merge:
 * true})` on a flat activityId -> activity map), never touching other
 * activity ids already synced for this rider.
 */
export async function syncActivitiesToRides(phone: string, athleteId: string, activities: CandidateActivity[]): Promise<number> {
  if (activities.length === 0) {
    return 0;
  }

  const activitiesMap: Record<string, unknown> = {};
  activities.forEach((activity) => {
    activitiesMap[activity.id] = {
      average_speed: String(activity.averageSpeed),
      distance: String(Math.round(activity.distanceKm * 1000)),
      elapsed_time: String(activity.elapsedTime),
      external_id: activity.externalId,
      flagged: activity.flagged,
      from_accepted_tag: activity.fromAcceptedTag,
      id: activity.id,
      manual: activity.manual,
      moving_time: String(activity.movingTime),
      name: activity.name,
      start_date: activity.startDate,
      total_elevation_gain: String(activity.elevationM),
      trainer: activity.trainer,
      type: activity.type,
      stravaId: athleteId,
    };
  });

  await adminDb.collection(RIDES_COLLECTION).doc(phone).set(activitiesMap, { merge: true });
  invalidateEventLeaderboardCache();
  return activities.length;
}
