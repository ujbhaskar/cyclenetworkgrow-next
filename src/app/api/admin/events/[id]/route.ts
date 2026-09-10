import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { deleteEvent, updateEvent } from "@/lib/events";
import { EVENT_STATUSES } from "@/lib/models/event";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/events/{id}:
 *   patch:
 *     summary: Update an event's status (or other fields)
 *     description: Requires admin role.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [draft, active, completed, archived] }
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid status
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const body = await request.json();

  if (body.status !== undefined && !EVENT_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${EVENT_STATUSES.join(", ")}` }, { status: 400 });
  }

  await updateEvent(id, body);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_updated_event",
    targetId: id,
    changes: body,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

/**
 * @swagger
 * /api/admin/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     description: Requires admin role. Irreversible.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;

  await deleteEvent(id);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_event",
    targetId: id,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
