import { verifySession } from "@/lib/auth/dal";
import { getUserProfile, ProfileUpdateError, updateOwnProfile } from "@/lib/user-profile";
import { PINCODE_PATTERN } from "@/lib/models/user";

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
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *                 description: 6-digit Indian PIN code
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
  const city = typeof body?.city === "string" ? body.city.trim() : undefined;
  const state = typeof body?.state === "string" ? body.state.trim() : undefined;
  const pincode = typeof body?.pincode === "string" ? body.pincode.trim() : undefined;

  if (!firstName) {
    return Response.json({ error: "First name is required" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "That email address isn't valid" }, { status: 400 });
  }
  if (pincode && !PINCODE_PATTERN.test(pincode)) {
    return Response.json({ error: "PIN code must be 6 digits" }, { status: 400 });
  }

  try {
    await updateOwnProfile(session.uid, { firstName, lastName, email, phone, address, city, state, pincode });
  } catch (err) {
    if (err instanceof ProfileUpdateError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const profile = await getUserProfile(session.uid);
  return Response.json({ profile });
}
