import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { createStravaSubscription, deleteStravaSubscription, getStravaSubscription } from "@/lib/strava";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/strava/subscription:
 *   get:
 *     summary: Current Strava push-subscription status
 *     description: Strava allows only one subscription per Client ID, globally — this reflects whichever app (this one or the legacy Angular app, same Client ID) last created it.
 *     tags:
 *       - Admin
 *       - Strava
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ subscription: { id, callbackUrl } | null }"
 */
export async function GET() {
  await requireRole("admin");
  const subscription = await getStravaSubscription();
  return Response.json({ subscription });
}

/**
 * @swagger
 * /api/admin/strava/subscription:
 *   post:
 *     summary: Create the Strava push subscription, pointed at this app
 *     description: Fails if one already exists (Strava allows only one per Client ID) — delete it first.
 *     tags:
 *       - Admin
 *       - Strava
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ subscription: { id, callbackUrl } }"
 *       400:
 *         description: Creation failed (often because one already exists)
 */
export async function POST() {
  const session = await requireRole("admin");

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const callbackUrl = `${protocol}://${host}/api/strava/webhook`;

  try {
    const subscription = await createStravaSubscription(callbackUrl);
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_created_strava_subscription",
      subscriptionId: subscription.id,
      callbackUrl,
      timestamp: new Date().toISOString(),
    });
    return Response.json({ subscription });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Creation failed" }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/admin/strava/subscription:
 *   delete:
 *     summary: Cancel the current Strava push subscription
 *     tags:
 *       - Admin
 *       - Strava
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Cancelled
 *       404:
 *         description: No subscription exists
 */
export async function DELETE() {
  const session = await requireRole("admin");

  const existing = await getStravaSubscription();
  if (!existing) {
    return Response.json({ error: "No subscription exists" }, { status: 404 });
  }

  await deleteStravaSubscription(existing.id);
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_strava_subscription",
    subscriptionId: existing.id,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
