import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { getRiderRideActivities, updateRiderRideActivities, type RideActivity } from "@/lib/admin-ride-flagging";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ phone: string }> };

/**
 * @swagger
 * /api/admin/rides/flag/{phone}:
 *   get:
 *     summary: Every synced activity for one rider, unfiltered
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ activities: RideActivity[] }"
 */
export async function GET(_request: Request, { params }: RouteParams) {
  await requireRole("admin");
  const { phone } = await params;
  const activities = await getRiderRideActivities(phone);
  return Response.json({ activities });
}

/**
 * @swagger
 * /api/admin/rides/flag/{phone}:
 *   post:
 *     summary: Write back the given (admin-edited) activities
 *     description: Additive merge — activities not included are left untouched. Matches the legacy admin's "update Rides in DB" (only re-uploads the selected rows).
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ updated: number }"
 *       400:
 *         description: No activities given
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { phone } = await params;
  const body = await request.json().catch(() => null);
  const activities: RideActivity[] = Array.isArray(body?.activities) ? body.activities : [];

  if (activities.length === 0) {
    return Response.json({ error: "No activities given" }, { status: 400 });
  }

  const updated = await updateRiderRideActivities(phone, activities);
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_updated_ride_flags",
    phone,
    activityIds: activities.map((a) => a.id),
    updated,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ updated });
}
