import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { syncActivitiesToRides, type CandidateActivity } from "@/lib/admin-missing-rides";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/rides/missing/sync:
 *   post:
 *     summary: Write the given (previously previewed) activities into rides/{phone}
 *     description: Additively merges — matches the legacy admin's exact write behavior, never touching other activity ids already synced for this rider.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ synced: number }"
 *       400:
 *         description: Invalid request
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const athleteId = typeof body?.athleteId === "string" ? body.athleteId : "";
  const activities: CandidateActivity[] = Array.isArray(body?.activities) ? body.activities : [];

  if (!phone || !athleteId || activities.length === 0) {
    return Response.json({ error: "phone, athleteId, and at least one activity are required" }, { status: 400 });
  }

  try {
    const synced = await syncActivitiesToRides(phone, athleteId, activities);
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_synced_missing_rides",
      phone,
      athleteId,
      activityIds: activities.map((a) => a.id),
      synced,
      timestamp: new Date().toISOString(),
    });
    return Response.json({ synced });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 400 });
  }
}
