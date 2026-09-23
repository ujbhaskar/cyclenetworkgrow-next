import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { applyStravaLinkUpdates } from "@/lib/legacy-registrations";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/strava-links:
 *   post:
 *     summary: Link the given already-registered riders to their now-connected Strava account
 *     description: >
 *       For riders who registered before connecting Strava — sets stravaId/profile (and
 *       access/refresh tokens) on each of the given phones' registration records, matched
 *       fresh against current Strava connections rather than trusting the client. Meant to be
 *       called with the `stravaLinkCandidates` phones a GET
 *       /api/admin/legacy-events/{eventId}/sync-registrations preview just showed the admin,
 *       after they've confirmed linking them.
 *     tags:
 *       - Admin
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phones]
 *             properties:
 *               phones:
 *                 type: array
 *                 items: { type: string }
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ linked: number }"
 *       400:
 *         description: No phones given, or linking failed
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { eventId } = await params;
  const body = await request.json().catch(() => ({}));
  const phones = Array.isArray(body.phones) ? body.phones.filter((p: unknown) => typeof p === "string") : [];

  if (phones.length === 0) {
    return Response.json({ error: "No phones given" }, { status: 400 });
  }

  try {
    const result = await applyStravaLinkUpdates(eventId, phones);
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_linked_event_riders_to_strava",
      eventId,
      phones,
      ...result,
      timestamp: new Date().toISOString(),
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Linking failed" }, { status: 400 });
  }
}
