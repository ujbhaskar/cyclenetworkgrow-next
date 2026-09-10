import { requireRole } from "@/lib/auth/dal";
import { generateTemporaryPassword, setUserPassword } from "@/lib/auth/admin-users";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/set-password:
 *   post:
 *     summary: Admin sets or resets a rider's password
 *     description: For riders without easy internet/email access — the admin communicates the resulting password to them offline (phone call, in person). Creates the account if it doesn't exist yet. Requires admin role.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or phone number of the rider.
 *               password:
 *                 type: string
 *                 description: Optional — a random password is generated if omitted.
 *     responses:
 *       200:
 *         description: Password set — response includes the plaintext password to relay to the rider.
 *       400:
 *         description: Missing identifier
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const { identifier, password } = await request.json();

  if (typeof identifier !== "string" || !identifier.trim()) {
    return Response.json({ error: "identifier is required" }, { status: 400 });
  }

  const finalPassword =
    typeof password === "string" && password.length >= 6 ? password : generateTemporaryPassword();

  const result = await setUserPassword(identifier.trim(), finalPassword);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: result.created ? "admin_created_user_with_password" : "admin_reset_password",
    targetIdentifier: identifier.trim(),
    targetUid: result.uid,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ uid: result.uid, created: result.created, password: finalPassword });
}
