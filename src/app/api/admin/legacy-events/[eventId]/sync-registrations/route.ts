import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { previewNewRiderRegistrations, addNewRiderRegistrations, previewStravaLinkUpdates } from "@/lib/legacy-registrations";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/sync-registrations:
 *   get:
 *     summary: Preview which riders a registration sync would add
 *     description: >
 *       Reads the tab named by the event's `registeredGoogleDataXLS` field, keeps captured
 *       Razorpay payments only, dedupes by phone, cross-references Strava-connected riders,
 *       and diffs the result against the event's CURRENT riders map. Read-only — nothing is
 *       written. POST to this same path with the returned phones to actually add them.
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
 *         description: "{ sheetName, totalRows, capturedRows, uniqueRegistrations, matchedWithStrava, existingRiderCount, newRiders: EventRider[], stravaLinkCandidates: StravaLinkCandidate[] }"
 *       400:
 *         description: Preview failed (e.g. no sheet configured, sheet/tab not found)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  await requireRole("admin");
  const { eventId } = await params;

  try {
    // Two independent diffs against the sheet vs. against Strava
    // connections — see previewStravaLinkUpdates for why this can't just
    // be folded into previewNewRiderRegistrations itself.
    const [preview, stravaLinks] = await Promise.all([
      previewNewRiderRegistrations(eventId),
      previewStravaLinkUpdates(eventId),
    ]);
    return Response.json({ ...preview, stravaLinkCandidates: stravaLinks.candidates });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Preview failed" }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/sync-registrations:
 *   post:
 *     summary: Add the given new riders from the registration sheet
 *     description: >
 *       Adds exactly the given phones' sheet registrations to the event's riders map —
 *       everyone else's entry (including any manual corrections made via the registrations
 *       page's edit modal) is left untouched. Meant to be called with the `newRiders` phones
 *       a GET preview just showed the admin, after they've confirmed adding them.
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
 *         description: "{ added: number }"
 *       400:
 *         description: No phones given, or the sync failed
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
    const result = await addNewRiderRegistrations(eventId, phones);
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_added_new_event_registrations",
      eventId,
      phones,
      ...result,
      timestamp: new Date().toISOString(),
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 400 });
  }
}
