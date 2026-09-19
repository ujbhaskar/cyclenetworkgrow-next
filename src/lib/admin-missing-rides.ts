import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { listStravaConnections } from "@/lib/strava";

// Same (misspelled) collection src/lib/strava.ts already uses.
const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic
// Same collection src/lib/admin-rides.ts and rider-metrics.ts already use.
const RIDES_COLLECTION = "rides";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

type StravaTokenDoc = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { id?: number | string; phone?: string };
};

async function findTokenDocByPhone(phone: string): Promise<{ athleteId: string; data: StravaTokenDoc } | null> {
  const snapshot = await adminDb.collection(ATHLETE_TOKENS_COLLECTION).where("athlete.phone", "==", phone).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? { athleteId: doc.id, data: doc.data() as StravaTokenDoc } : null;
}

// The token doc's id IS the Strava athlete id (see strava.ts's
// saveStravaConnection), so this is a direct lookup, not a query.
async function findTokenDocById(athleteId: string): Promise<{ athleteId: string; data: StravaTokenDoc } | null> {
  const doc = await adminDb.collection(ATHLETE_TOKENS_COLLECTION).doc(athleteId).get();
  return doc.exists ? { athleteId: doc.id, data: doc.data() as StravaTokenDoc } : null;
}

export type RiderSearchResult = {
  athleteId: string;
  name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  profileImageUrl: string | null;
};

/**
 * Name search over every Strava-connected rider — lets an admin find the
 * right person to pull missing rides for without already knowing their
 * phone or Strava athlete id. Reuses listStravaConnections (same data the
 * "Strava-Connected Riders" admin page shows) and filters in memory —
 * fine at this app's rider-count scale (see rider-metrics.ts's own note on
 * data volume), and Firestore has no case-insensitive substring query
 * anyway.
 */
export async function searchRidersByName(query: string): Promise<RiderSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  const connections = await listStravaConnections();
  return connections
    .filter((connection) => `${connection.firstName ?? ""} ${connection.lastName ?? ""}`.toLowerCase().includes(trimmed))
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

async function refreshStravaToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Never the legacy admin's pattern of doing this refresh (and the token
// fetch below) directly from the browser with the client secret typed into
// a form field — see docs/REQUIREMENTS.md §4's note on this being "a fix,
// not a carry-over". Both stay server-side here.
async function getValidAccessToken(athleteId: string, data: StravaTokenDoc): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (data.access_token && data.expires_at && data.expires_at > nowSeconds + 60) {
    return data.access_token;
  }
  if (!data.refresh_token) {
    throw new Error("No refresh token on file for this rider — they'll need to reconnect Strava.");
  }
  const refreshed = await refreshStravaToken(data.refresh_token);
  await adminDb.collection(ATHLETE_TOKENS_COLLECTION).doc(athleteId).update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
  });
  return refreshed.access_token;
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
    ? await findTokenDocById(identifier.athleteId)
    : identifier.phone
      ? await findTokenDocByPhone(identifier.phone)
      : null;
  if (!found) {
    throw new Error("This rider hasn't connected Strava.");
  }
  const phone = found.data.athlete?.phone;
  if (!phone) {
    throw new Error("This Strava connection has no phone number on file.");
  }
  const accessToken = await getValidAccessToken(found.athleteId, found.data);

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
  return activities.length;
}
