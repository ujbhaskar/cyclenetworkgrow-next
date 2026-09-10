import { verifySession } from "@/lib/auth/dal";
import { getUserProfile, ProfileUpdateError, updateOwnProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Edit the signed-in user's name, email, phone, or address
 *     description: Updates only the fields provided — anything omitted keeps its current value. A changed email updates the Firebase Auth sign-in credential itself, not just the Firestore mirror.
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated profile
 */
export async function PATCH(request: Request) {
  const session = await verifySession();
  const body = await request.json().catch(() => null);

  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : undefined;
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : undefined;
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;
  const address = typeof body?.address === "string" ? body.address.trim() : undefined;

  if (!firstName) {
    return Response.json({ error: "First name is required" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "That email address isn't valid" }, { status: 400 });
  }

  try {
    await updateOwnProfile(session.uid, { firstName, lastName, email, phone, address });
  } catch (err) {
    if (err instanceof ProfileUpdateError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const profile = await getUserProfile(session.uid);
  return Response.json({ profile });
}
