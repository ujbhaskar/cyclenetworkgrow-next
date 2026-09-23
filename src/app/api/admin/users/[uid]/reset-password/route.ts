import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { resetUserPasswordByUid } from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ uid: string }> };

/**
 * @swagger
 * /api/admin/users/{uid}/reset-password:
 *   post:
 *     summary: Reset a user's password directly from the Users list
 *     description: >
 *       Requires admin role. Generates a random password (or uses the given one) and sets
 *       it on this user's Firebase Auth account. The client is responsible for confirming
 *       with the admin before calling this — see UsersTable.tsx.
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Optional — a random password is generated if omitted.
 *     responses:
 *       200:
 *         description: "{ password: string } — relay this to the user, it won't be shown again"
 *       400:
 *         description: Reset failed (e.g. no such account)
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { uid } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await resetUserPasswordByUid(uid, typeof body.password === "string" ? body.password : undefined);

    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "admin_reset_user_password",
      targetUid: uid,
      timestamp: new Date().toISOString(),
    });

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Reset failed" }, { status: 400 });
  }
}
