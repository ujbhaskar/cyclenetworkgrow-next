import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { listRideSummaries, deleteRides } from "@/lib/admin-rides";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/rides/cleanup:
 *   get:
 *     summary: List every rider with a synced-rides doc, with ride count and (best-effort) name/photo
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ riders: RideSummary[] }"
 */
export async function GET() {
  await requireRole("admin");
  const riders = await listRideSummaries();
  return Response.json({ riders });
}

/**
 * @swagger
 * /api/admin/rides/cleanup:
 *   post:
 *     summary: Bulk-delete the given riders' synced-rides docs
 *     description: Irreversible — only use once the event's data is backed up elsewhere.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ deleted: number }"
 *       400:
 *         description: No phones given
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);
  const phones = Array.isArray(body?.phones) ? body.phones.filter((p: unknown) => typeof p === "string") : [];

  if (phones.length === 0) {
    return Response.json({ error: "No phones given" }, { status: 400 });
  }

  const result = await deleteRides(phones);
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_rides",
    phones,
    deleted: result.deleted,
    timestamp: new Date().toISOString(),
  });

  return Response.json(result);
}
