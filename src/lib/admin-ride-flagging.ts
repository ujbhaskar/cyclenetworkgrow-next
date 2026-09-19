import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { listStravaConnections } from "@/lib/strava";

// Same collection admin-rides.ts/admin-missing-rides.ts and rider-metrics.ts
// already use.
const RIDES_COLLECTION = "rides";

export type RiderSearchResult = {
  athleteId: string;
  name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  profileImageUrl: string | null;
};

/**
 * Name/city/phone search over every Strava-connected rider — mirrors the
 * legacy admin's "Search by name, city or phone" box on its Ride Flagging
 * page (FlagCheatRidesComponent), used to pick which rider's rides to
 * browse. Filters listStravaConnections() in memory, same as this app's
 * other admin rider searches.
 */
export async function searchRidersForFlagging(query: string): Promise<RiderSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  const connections = await listStravaConnections();
  return connections
    .filter((connection) => {
      const name = `${connection.firstName ?? ""} ${connection.lastName ?? ""}`.toLowerCase();
      const city = (connection.resolvedCity ?? "").toLowerCase();
      const phone = connection.phone ?? "";
      return name.includes(trimmed) || city.includes(trimmed) || phone.includes(trimmed);
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

// The raw shape a ride activity is stored in under rides/{phone} — same
// fields src/lib/admin-missing-rides.ts writes when syncing a new one.
// Kept as a passthrough bag here (not decomposed into a narrower type)
// since this feature's whole point is round-tripping whatever's already
// stored, editing only a few fields, without dropping anything else.
export type RideActivity = {
  id: string;
  name: string;
  distance: string;
  total_elevation_gain: string;
  type: string;
  start_date: string;
  trainer: boolean;
  flagged: boolean;
  manual?: boolean;
  from_accepted_tag?: boolean;
  average_speed?: string;
  elapsed_time?: string;
  moving_time?: string;
  external_id?: string;
  stravaId?: string | number;
  [key: string]: unknown;
};

/** Every activity currently stored for one rider, unfiltered — the full
 * rides/{phone} doc, for browsing/editing rather than qualifying-ride
 * display. */
export async function getRiderRideActivities(phone: string): Promise<RideActivity[]> {
  const doc = await adminDb.collection(RIDES_COLLECTION).doc(phone).get();
  if (!doc.exists) {
    return [];
  }
  const data = doc.data() as Record<string, RideActivity>;
  return Object.entries(data)
    .map(([activityId, activity]) => ({ ...activity, id: activity.id ?? activityId }))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
}

/**
 * Writes back the given (admin-edited) activities — additive merge, same
 * as admin-missing-rides.ts's sync, so activities not included here are
 * left untouched. Matches the legacy admin's updateDB (only the *selected*
 * rows get re-uploaded, everything else on the doc is left as-is).
 */
export async function updateRiderRideActivities(phone: string, activities: RideActivity[]): Promise<number> {
  if (activities.length === 0) {
    return 0;
  }
  const update: Record<string, RideActivity> = {};
  activities.forEach((activity) => {
    update[activity.id] = activity;
  });
  await adminDb.collection(RIDES_COLLECTION).doc(phone).set(update, { merge: true });
  return activities.length;
}

/**
 * Actually deletes one activity from a rider's rides doc — the legacy
 * admin's "Remove" button only ever removed the activity from its local
 * in-browser state (delete this.userRides[id]) and never persisted that
 * removal, since updateDB only re-uploads *selected* rows and Firestore's
 * merge write never deletes keys missing from the payload. Fixed here:
 * Remove now really deletes it.
 */
export async function deleteRiderRideActivity(phone: string, activityId: string): Promise<void> {
  await adminDb
    .collection(RIDES_COLLECTION)
    .doc(phone)
    .update({ [activityId]: FieldValue.delete() });
}
