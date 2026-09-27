import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { updateEventRiderByAdmin, removeEventRiderByAdmin } from "@/lib/legacy-registrations";

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

/**
 * @swagger
 * /api/admin/legacy-events/{eventId}/riders/{phone}:
 *   delete:
 *     summary: Remove one rider's registration from this event
 *     description: >
 *       Deletes this one entry from the event's registration list — for a duplicate,
 *       mistaken/test registration, or a withdrawal. Doesn't touch their already-synced
 *       rides/{phone} ride history (same accepted limitation as the PATCH edit above); if
 *       they're re-added later under the same phone, their past rides resurface as-is.
 *       Requires admin role.
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
 *     responses:
 *       200:
 *         description: "{ ok: true }"
 *       400:
 *         description: Rider/event not found
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { eventId, phone } = await params;

  try {
    await removeEventRiderByAdmin(eventId, phone);

    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_removed_event_rider",
      eventId,
      phone,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't remove this rider" }, { status: 400 });
  }
}
