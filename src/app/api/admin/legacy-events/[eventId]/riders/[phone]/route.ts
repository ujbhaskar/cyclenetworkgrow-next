import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { updateEventRiderByAdmin } from "@/lib/legacy-registrations";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string; phone: string }> };

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/riders/{phone}:
 *   patch:
 *     summary: Correct one registered rider's name/city/state/phone
 *     description: >
 *       Fixes a typo directly on this one rider's entry in the event's registration list —
 *       doesn't touch anyone else's entry, and (deliberately) doesn't move their existing
 *       synced rides if the phone number changes; see updateEventRiderByAdmin. Requires
 *       admin role.
 *     tags:
 *       - Admin
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: The rider's current phone number (their key in the registration list) before this edit.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Updated rider record
 *       400:
 *         description: Rider/event not found, or the new phone is already taken by another rider
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { eventId, phone } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const updated = await updateEventRiderByAdmin(eventId, phone, {
      full_name: typeof body.full_name === "string" ? body.full_name : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
    });

    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_edited_event_rider",
      eventId,
      previousPhone: phone,
      changes: body,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ rider: updated });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't save changes" }, { status: 400 });
  }
}
