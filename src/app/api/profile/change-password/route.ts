import { verifySession } from "@/lib/auth/dal";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/profile/change-password:
 *   post:
 *     summary: Change the signed-in user's own password
 *     description: >
 *       Requires only a valid session — the signed-in session cookie is the proof of identity,
 *       same as any other self-service /api/profile write. Sets the new password directly via
 *       the Admin SDK.
 *     tags:
 *       - Profile
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: "{ ok: true }"
 *       400:
 *         description: Password too short, or the update failed
 */
export async function POST(request: Request) {
  const session = await verifySession();
  const body = await request.json().catch(() => ({}));
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  try {
    await adminAuth.updateUser(session.uid, { password: newPassword });
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action: "user_changed_own_password",
      targetUid: session.uid,
      timestamp: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't change password" }, { status: 400 });
  }
}
