import { verifySession } from "@/lib/auth/dal";
import { getUserProfile, setStravaConnected } from "@/lib/user-profile";
import { disconnectStrava, getStravaConnectionByPhone } from "@/lib/strava";

/**
 * @swagger
 * /api/profile/strava:
 *   delete:
 *     summary: Disconnect the signed-in rider's Strava account
 *     tags:
 *       - Strava
 *     responses:
 *       200:
 *         description: Disconnected
 *       404:
 *         description: No Strava connection on file for this rider
 */
export async function DELETE() {
  const session = await verifySession();
  const profile = await getUserProfile(session.uid);

  if (!profile?.phone) {
    return Response.json({ error: "No phone on file" }, { status: 404 });
  }

  const connection = await getStravaConnectionByPhone(profile.phone);
  if (!connection) {
    return Response.json({ error: "Not connected" }, { status: 404 });
  }

  await disconnectStrava(connection.athleteId);
  await setStravaConnected(session.uid, false);

  return Response.json({ ok: true });
}
