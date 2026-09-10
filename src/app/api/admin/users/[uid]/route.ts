import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { deleteUserCompletely, setUserRole } from "@/lib/admin-user-management";
import { ROLES } from "@/lib/models/user";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ uid: string }> };

/**
 * @swagger
 * /api/admin/users/{uid}:
 *   patch:
 *     summary: Change a user's role
 *     description: Sets the Firebase custom claim (the actual authorization source — see docs/ARCHITECTURE.md §4) and the Firestore mirror together. Requires admin role. Takes effect the next time the target user's session refreshes.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [rider, manager, admin]
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { uid } = await params;
  const { role } = await request.json();

  if (!ROLES.includes(role)) {
    return Response.json({ error: `role must be one of: ${ROLES.join(", ")}` }, { status: 400 });
  }

  await setUserRole(uid, role);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_changed_role",
    targetUid: uid,
    role,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

/**
 * @swagger
 * /api/admin/users/{uid}:
 *   delete:
 *     summary: Delete a user (Auth account + Firestore profile)
 *     description: Requires admin role. Irreversible.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { uid } = await params;

  if (uid === session.uid) {
    return Response.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  await deleteUserCompletely(uid);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_user",
    targetUid: uid,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
