import { adminDb } from "@/lib/firebase/admin";
import { STRAVA_WEBHOOK_VERIFY_TOKEN } from "@/lib/strava";

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

/**
 * @swagger
 * /api/strava/webhook:
 *   post:
 *     summary: Strava activity/athlete event
 *     description: >
 *       Strava expects a fast 200 ack — actual sync (attribution to a
 *       running event, fetching/filtering the activity, leaderboard
 *       recompute) is NOT implemented here yet, it's a bigger separate
 *       piece of work (see docs/ARCHITECTURE.md §5). For now this just
 *       records the raw event so nothing Strava sends is silently lost
 *       before that's built.
 *     tags:
 *       - Strava
 *     responses:
 *       200:
 *         description: Acknowledged
 */
export async function POST(request: Request) {
  const event = await request.json().catch(() => null);

  if (event) {
    // Fire-and-forget-ish: awaited so a write failure is at least logged,
    // but never blocks the ack — Strava disables a subscription that's
    // consistently slow to respond.
    adminDb
      .collection("stravaWebhookEvents")
      .add({ ...event, receivedAt: new Date().toISOString() })
      .catch((err) => console.error("[strava webhook] failed to record event:", err));
  }

  return Response.json({ ok: true });
}
