import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { previewRazorpayRegistrations, addRazorpayRegistrations } from "@/lib/razorpay-registrations";
import { previewStravaLinkUpdates } from "@/lib/legacy-registrations";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/sync-razorpay:
 *   get:
 *     summary: Preview which riders a Razorpay-based registration sync would add
 *     description: >
 *       Reads captured payments directly from Razorpay's Payments API (no manual Excel
 *       export / Google Sheet update needed) for a date window around this event's start
 *       date, and diffs the result against the event's CURRENT riders map. Read-only —
 *       nothing is written. POST to this same path with the returned phones to actually
 *       add them.
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
 *         description: "{ capturedPayments, uniqueRegistrations, existingRiderCount, newRiders: EventRider[], stravaLinkCandidates }"
 *       400:
 *         description: Preview failed (e.g. event not found, Razorpay API error)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  await requireRole("admin");
  const { eventId } = await params;

  try {
    // Two independent checks in one response — same pairing
    // sync-registrations (the Google Sheet path) does, so an
    // already-registered rider who's connected Strava since shows up
    // here too regardless of which source added them originally.
    const [preview, stravaLinks] = await Promise.all([
      previewRazorpayRegistrations(eventId),
      previewStravaLinkUpdates(eventId),
    ]);
    return Response.json({ ...preview, stravaLinkCandidates: stravaLinks.candidates });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Preview failed" }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/sync-razorpay:
 *   post:
 *     summary: Add the given new riders found via Razorpay
 *     description: >
 *       Adds exactly the given phones' Razorpay-sourced registrations to the event's riders
 *       map — everyone else's entry (including manual corrections) is left untouched. Meant
 *       to be called with the `newRiders` phones a GET preview just showed the admin, after
 *       they've confirmed adding them.
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
    const result = await addRazorpayRegistrations(eventId, phones);
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_added_razorpay_event_registrations",
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
