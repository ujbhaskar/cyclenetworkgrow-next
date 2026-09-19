import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { syncEventRegistrationsFromSheet } from "@/lib/legacy-registrations";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/sync-registrations:
 *   post:
 *     summary: Rebuild a legacy event's riders from its registration Google Sheet
 *     description: Reads the tab named by the event's `registeredGoogleDataXLS` field, keeps captured Razorpay payments only, dedupes by phone, cross-references Strava-connected riders, and REPLACES the event's whole `riders` map — same behavior as the legacy Angular admin's "Sync users from registrations" button.
 *     tags:
 *       - Admin
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ sheetName, totalRows, capturedRows, uniqueRegistrations, matchedWithStrava }"
 *       400:
 *         description: Sync failed (e.g. no sheet configured, sheet/tab not found)
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { eventId } = await params;

  try {
    const result = await syncEventRegistrationsFromSheet(eventId);
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_synced_legacy_event_registrations",
      eventId,
      ...result,
      timestamp: new Date().toISOString(),
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 400 });
  }
}
