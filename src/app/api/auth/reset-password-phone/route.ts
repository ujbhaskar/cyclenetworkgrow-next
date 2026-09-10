import { adminAuth } from "@/lib/firebase/admin";
import { setUserPassword } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/auth/reset-password-phone:
 *   post:
 *     summary: Reset a rider's password after phone OTP verification
 *     description: |
 *       Called right after a client-side Firebase phone OTP sign-in succeeds
 *       (forgot-password flow). That sign-in authenticates a throwaway
 *       phone-provider identity, not the rider's real account — this
 *       endpoint verifies the resulting ID token really came from a phone
 *       sign-in just now, then uses the Admin SDK to set the new password
 *       on the real account (looked up by the phone number's synthetic
 *       email — see docs/ARCHITECTURE.md §4). Does not sign the caller in;
 *       the client redirects to /login afterward.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken, newPassword]
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: ID token from the just-completed phone OTP sign-in.
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset
 *       401:
 *         description: Invalid or non-phone ID token
 *       400:
 *         description: Missing fields
 */
export async function POST(request: Request) {
  const { idToken, newPassword } = await request.json();

  if (typeof idToken !== "string" || !idToken || typeof newPassword !== "string" || newPassword.length < 6) {
    return Response.json({ error: "idToken and a newPassword (min 6 chars) are required" }, { status: 400 });
  }

  let phoneNumber: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.firebase.sign_in_provider !== "phone" || !decoded.phone_number) {
      return Response.json({ error: "This token did not come from a phone sign-in" }, { status: 401 });
    }
    phoneNumber = decoded.phone_number;
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const result = await setUserPassword(phoneNumber, newPassword);
  return Response.json({ uid: result.uid });
}
