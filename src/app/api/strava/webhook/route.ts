import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { STRAVA_WEBHOOK_VERIFY_TOKEN } from "@/lib/strava";
import { findStravaTokenDocById, getValidStravaAccessToken } from "@/lib/strava-tokens";
import { getEventAdminDetail } from "@/lib/events";
import { EVENT_1177_ID, invalidateEventLeaderboardCache } from "@/lib/rider-metrics";
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

// Persisted onto the event's own stravaWebhookEvents doc (see the outcome
// param threaded through below) so the admin viewer can show "accepted vs
// discarded, and why" without a second data source (e.g. Cloud Logging) —
// this is genuinely more query-able and doesn't need the app's own
// service account granted log-reading permissions it doesn't have today.
type Outcome = { outcome: "accepted" | "discarded" | "deleted" | "not_participant" | "ignored" | "error"; reason: string };

/**
 * Turns one webhook "create" event into a rides/{phone} write — mirrors
 * letscng-api's webhookController.postWebhook, except the elapsed/moving
 * ratio is never used to drop a ride (same "disabled pending decision" as
 * aw80d.ts) and the distance thresholds come from rideRulesConfig instead
 * of being hardcoded.
 */
async function ingestCreatedActivity(activityId: number, athleteId: number, phone: string): Promise<Outcome> {
  const tokenDoc = await findStravaTokenDocById(String(athleteId));
  if (!tokenDoc) {
    const reason = `No Strava token on file for athlete ${athleteId}`;
    console.error(`[strava webhook] ${reason}, can't fetch activity ${activityId}`);
    return { outcome: "error", reason };
  }

  const [accessToken, rules] = await Promise.all([
    getValidStravaAccessToken(tokenDoc.athleteId, tokenDoc.data),
    getRideRulesConfig(),
  ]);
  const activity = await fetchActivity(activityId, accessToken);

  if (activity.type !== "Ride" && activity.type !== "VirtualRide") {
    return { outcome: "discarded", reason: `Not a Ride/VirtualRide (type=${activity.type})` };
  }
  if (activity.manual) {
    return { outcome: "discarded", reason: "Manually-entered activity, not GPS-tracked" };
  }
  if (activity.from_accepted_tag) {
    return { outcome: "discarded", reason: "Created from a tagged/accepted activity" };
  }
  if (activity.distance < rules.minRideDistanceKm * 1000) {
    const distanceKm = (activity.distance / 1000).toFixed(1);
    return { outcome: "discarded", reason: `Below the ${rules.minRideDistanceKm}km minimum (${distanceKm}km)` };
  }

  // Rules PDF has no distance cap for virtual/trainer rides — only the
  // 75% point adjustment (§6d) and the general elapsed/moving-time-ratio
  // check apply to them, same as outdoor rides. Recorded as Strava reports
  // it, uncapped.
  const distance = activity.distance;

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
  const distanceKm = Math.round(distance / 1000);
  console.log(`[strava webhook] ingested activity ${activityId} (${activity.type}, ${distanceKm}km) for phone ${phone}`);
  invalidateEventLeaderboardCache();
  return { outcome: "accepted", reason: `Ingested — ${activity.type}, ${distanceKm}km` };
}

/**
 * @swagger
 * /api/strava/webhook:
 *   post:
 *     summary: Strava activity/athlete event
 *     description: >
 *       For activity create/delete events from an athlete registered for
 *       the current "1177 Grand Endurance" event (see EVENT_1177_ID), syncs
 *       rides/{phone} directly, the same collection the leaderboard reads.
 *       Records an audit doc once the outcome is known, except for two
 *       high-volume no-op reasons that are acknowledged without ever
 *       writing to Firestore: "Athlete not registered for the 1177 event"
 *       (fires for every Strava user's activity, not just participants) and
 *       "Not a Ride/VirtualRide" (fires for every non-cycling activity a
 *       participant logs). Other aspect types (update, athlete events) are
 *       acknowledged and otherwise ignored too, matching letscng-api's
 *       webhook behavior.
 *     tags:
 *       - Strava
 *     responses:
 *       200:
 *         description: Acknowledged
 */
export async function POST(request: Request) {
  const event = (await request.json().catch(() => null)) as StravaWebhookEvent | null;
  if (!event) {
    return Response.json({ ok: true });
  }

  // The audit doc is written once, after the outcome is known, rather than
  // created eagerly then updated — cheaper, and lets specific outcomes
  // (see below) skip the write entirely. expiresAt drives this collection's
  // TTL policy (see docs/DEPLOY.md) so the audit log doesn't grow forever.
  const receivedAt = new Date();

  async function recordEvent(result: Outcome) {
    try {
      await adminDb.collection("stravaWebhookEvents").add({
        ...event,
        receivedAt,
        expiresAt: new Date(receivedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        outcome: result.outcome,
        outcomeReason: result.reason,
      });
    } catch (err) {
      console.error("[strava webhook] failed to record event:", err);
    }
  }

  if (event.object_type !== "activity" || !event.object_id || !event.owner_id) {
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
      // letscng-api, silently ack and do nothing. Not logged: by far the
      // most common no-op (every Strava user's activity fires this
      // webhook, not just 1177 participants) and carries no audit value.
      return Response.json({ ok: true });
    }

    if (event.aspect_type === "delete") {
      const deleted = await adminDb
        .collection(RIDES_COLLECTION)
        .doc(participant.phone)
        .update({ [String(event.object_id)]: FieldValue.delete() })
        .then(() => true)
        .catch(() => false); // No rides doc (or field) for this phone yet — nothing to delete.
      console.log(`[strava webhook] deleted activity ${event.object_id} for phone ${participant.phone}`);
      if (deleted) {
        invalidateEventLeaderboardCache();
      }
      // Deletes were never logged even before this change (an audit doc
      // was only ever created for aspect_type === "create").
      return Response.json({ ok: true });
    }

    const result = await ingestCreatedActivity(event.object_id, event.owner_id, participant.phone);
    // The other high-volume no-op reason: a non-cycling activity (run,
    // swim, walk, etc.) from a participant fires this same webhook for
    // every activity they log, not just rides.
    if (result.outcome === "discarded" && result.reason.startsWith("Not a Ride/VirtualRide")) {
      return Response.json({ ok: true });
    }
    await recordEvent(result);
    return Response.json({ ok: true });
  } catch (err) {
    // Ack anyway — Strava retries/disables on repeated failure or timeout.
    console.error("[strava webhook] failed to process event:", err);
    await recordEvent({ outcome: "error", reason: err instanceof Error ? err.message : "Unknown error" });
    return Response.json({ ok: true });
  }
}
