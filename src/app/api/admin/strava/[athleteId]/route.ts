import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { disconnectStrava } from "@/lib/strava";

type RouteParams = { params: Promise<{ athleteId: string }> };

/**
 * @swagger
 * /api/admin/strava/{athleteId}:
 *   delete:
 *     summary: Revoke a rider's Strava connection (admin)
 *     description: Same effect as the rider disconnecting themselves from their profile — see docs/ARCHITECTURE.md §7.1.
 *     tags:
 *       - Admin
 *       - Strava
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Revoked
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { athleteId } = await params;

  await disconnectStrava(athleteId);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_revoked_strava",
    targetAthleteId: athleteId,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
