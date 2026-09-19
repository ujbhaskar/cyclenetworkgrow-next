import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { deleteRiderRideActivity } from "@/lib/admin-ride-flagging";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ phone: string; activityId: string }> };

/**
 * @swagger
 * /api/admin/rides/flag/{phone}/{activityId}:
 *   delete:
 *     summary: Permanently delete one activity from a rider's rides doc
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Deleted
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { phone, activityId } = await params;

  await deleteRiderRideActivity(phone, activityId);
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_ride_activity",
    phone,
    activityId,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
