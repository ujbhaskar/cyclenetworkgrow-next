import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { deleteUserCompletely, setUserRole, updateUserProfileByAdmin } from "@/lib/admin-user-management";
import { ROLES } from "@/lib/models/user";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ uid: string }> };

/**
 * @swagger
 * /api/admin/users/{uid}:
 *   patch:
 *     summary: Change a user's role, or correct their name/city/state/phone
 *     description: >
 *       Two independent uses of the same endpoint, distinguished by which fields the body has.
 *       `role` sets the Firebase custom claim (the actual authorization source — see
 *       docs/ARCHITECTURE.md §4) and the Firestore mirror together, taking effect the next
 *       time the target user's session refreshes. `firstName`/`lastName`/`city`/`state`/`phone`
 *       update the Firestore profile directly — for an admin fixing a rider's typo'd details
 *       from the Users list, since email/password stay off-limits here (see
 *       updateUserProfileByAdmin).
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
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [rider, manager, admin]
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid role, or no recognized fields given
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { uid } = await params;
  const body = await request.json().catch(() => ({}));

  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) {
      return Response.json({ error: `role must be one of: ${ROLES.join(", ")}` }, { status: 400 });
    }

    await setUserRole(uid, body.role);

    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_changed_role",
      targetUid: uid,
      role: body.role,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  }

  if (typeof body.firstName === "string") {
    await updateUserProfileByAdmin(uid, {
      firstName: body.firstName,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
    });

    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_edited_user_profile",
      targetUid: uid,
      changes: { firstName: body.firstName, lastName: body.lastName, city: body.city, state: body.state, phone: body.phone },
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  }

  return Response.json({ error: "No recognized fields given (role, or firstName/lastName/city/state/phone)" }, { status: 400 });
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
