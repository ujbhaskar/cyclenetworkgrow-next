import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { STRAVA_WEBHOOK_VERIFY_TOKEN } from "@/lib/strava";
import { findStravaTokenDocById, getValidStravaAccessToken } from "@/lib/strava-tokens";
import { getEventAdminDetail } from "@/lib/events";
import { EVENT_1177_ID } from "@/lib/rider-metrics";
import { getRideRulesConfig } from "@/lib/ride-rules";

const RIDES_COLLECTION = "rides";
const STRAVA_ACTIVITY_URL = "https://www.strava.com/api/v3/activities";

/**
 * @swagger
 * /api/strava/webhook:
 *   get:
 *     summary: Strava push-subscription verification handshake
 *     description: Strava calls this synchronously when a subscription is created (see /api/admin/strava/subscription's POST), and echoes hub.challenge back if hub.verify_token matches.
 *     tags:
 *       - Strava
 *     responses:
 *       200:
 *         description: "{ \"hub.challenge\": string }"
 *       403:
 *         description: Verify token mismatch
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || token !== STRAVA_WEBHOOK_VERIFY_TOKEN || !challenge) {
    return Response.json({ error: "Verification failed" }, { status: 403 });
  }

  return Response.json({ "hub.challenge": challenge });
}

type StravaWebhookEvent = {
  object_type?: string;
  object_id?: number;
  aspect_type?: "create" | "update" | "delete";
  owner_id?: number;
};

type RawStravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  type: string;
  start_date: string;
  trainer: boolean;
  manual: boolean;
  flagged?: boolean;
  from_accepted_tag?: boolean;
  external_id?: string;
};

async function fetchActivity(activityId: number, accessToken: string): Promise<RawStravaActivity> {
  const res = await fetch(`${STRAVA_ACTIVITY_URL}/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activity fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Turns one webhook "create" event into a rides/{phone} write — mirrors
 * letscng-api's webhookController.postWebhook, except the elapsed/moving
 * ratio is never used to drop a ride (same "disabled pending decision" as
 * aw80d.ts) and the distance thresholds come from rideRulesConfig instead
 * of being hardcoded.
 */
async function ingestCreatedActivity(activityId: number, athleteId: number, phone: string): Promise<void> {
  const tokenDoc = await findStravaTokenDocById(String(athleteId));
  if (!tokenDoc) {
    console.error(`[strava webhook] no token on file for athlete ${athleteId}, can't fetch activity ${activityId}`);
    return;
  }

  const [accessToken, rules] = await Promise.all([
    getValidStravaAccessToken(tokenDoc.athleteId, tokenDoc.data),
    getRideRulesConfig(),
  ]);
  const activity = await fetchActivity(activityId, accessToken);

  if (
    (activity.type !== "Ride" && activity.type !== "VirtualRide") ||
    activity.manual ||
    activity.from_accepted_tag ||
    activity.distance < rules.minRideDistanceKm * 1000
  ) {
    console.log(
      `[strava webhook] skipped activity ${activityId} for phone ${phone}: type=${activity.type} manual=${activity.manual} fromTag=${activity.from_accepted_tag} distanceM=${activity.distance} (min=${rules.minRideDistanceKm * 1000})`,
    );
    return;
  }

  let distance = activity.distance;
  if (activity.type === "VirtualRide" || activity.trainer) {
    distance = Math.min(distance, rules.maxVirtualRideDistanceKm * 1000);
  }

  await adminDb
    .collection(RIDES_COLLECTION)
    .doc(phone)
    .set(
      {
        [String(activity.id)]: {
          id: String(activity.id),
          name: activity.name,
          distance: String(Math.round(distance)),
          moving_time: String(activity.moving_time),
          elapsed_time: String(activity.elapsed_time),
          total_elevation_gain: String(activity.total_elevation_gain),
          average_speed: String(activity.average_speed),
          type: activity.type,
          start_date: activity.start_date,
          trainer: Boolean(activity.trainer),
          manual: Boolean(activity.manual),
          from_accepted_tag: Boolean(activity.from_accepted_tag),
          external_id: activity.external_id ?? "",
          stravaId: String(athleteId),
        },
      },
      { merge: true },
    );
  console.log(`[strava webhook] ingested activity ${activityId} (${activity.type}, ${Math.round(distance / 1000)}km) for phone ${phone}`);
}

/**
 * @swagger
 * /api/strava/webhook:
 *   post:
 *     summary: Strava activity/athlete event
 *     description: >
 *       Records the raw event (audit trail, same as before), then — for
 *       activity create/delete events from an athlete registered for the
 *       current "1177 Grand Endurance" event (see EVENT_1177_ID) — syncs
 *       rides/{phone} directly, the same collection the leaderboard reads.
 *       Non-participants and other aspect types (update, athlete events)
 *       are acknowledged and otherwise ignored, matching letscng-api's
 *       webhook behavior.
 *     tags:
 *       - Strava
 *     responses:
 *       200:
 *         description: Acknowledged
 */
export async function POST(request: Request) {
  const event = (await request.json().catch(() => null)) as StravaWebhookEvent | null;

  if (event) {
    // Not awaited into the response — Strava disables a subscription
    // that's consistently slow to ack. expiresAt drives this collection's
    // Firestore TTL policy (see docs/DEPLOY.md) so this audit log doesn't
    // grow forever.
    const receivedAt = new Date();
    adminDb
      .collection("stravaWebhookEvents")
      .add({ ...event, receivedAt, expiresAt: new Date(receivedAt.getTime() + 7 * 24 * 60 * 60 * 1000) })
      .catch((err) => console.error("[strava webhook] failed to record event:", err));
  }

  if (!event || event.object_type !== "activity" || !event.object_id || !event.owner_id) {
    return Response.json({ ok: true });
  }
  if (event.aspect_type !== "create" && event.aspect_type !== "delete") {
    return Response.json({ ok: true });
  }

  try {
    const currentEvent = await getEventAdminDetail(EVENT_1177_ID);
    const participant = currentEvent?.riders.find(
      (rider) => rider.stravaId != null && String(rider.stravaId) === String(event.owner_id),
    );
    if (!participant) {
      // Not registered for the event we're syncing rides for — same as
      // letscng-api, silently ack and do nothing.
      return Response.json({ ok: true });
    }

    if (event.aspect_type === "delete") {
      await adminDb
        .collection(RIDES_COLLECTION)
        .doc(participant.phone)
        .update({ [String(event.object_id)]: FieldValue.delete() })
        .then(() => console.log(`[strava webhook] deleted activity ${event.object_id} for phone ${participant.phone}`))
        .catch(() => {
          // No rides doc (or field) for this phone yet — nothing to delete.
        });
    } else {
      await ingestCreatedActivity(event.object_id, event.owner_id, participant.phone);
    }
  } catch (err) {
    // Ack anyway — Strava retries/disables on repeated failure or timeout,
    // and the raw event is already recorded above for manual replay.
    console.error("[strava webhook] failed to process event:", err);
  }

  return Response.json({ ok: true });
}
