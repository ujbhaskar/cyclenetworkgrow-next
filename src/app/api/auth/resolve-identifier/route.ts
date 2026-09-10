import { adminDb } from "@/lib/firebase/admin";
import { normalizePhone } from "@/lib/auth/phone";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/auth/resolve-identifier:
 *   post:
 *     summary: Resolve a phone number to the account's real login email
 *     description: |
 *       Firebase Auth only allows one password-type credential per account,
 *       so email is the sole login credential — a phone number can't also
 *       be linked as a second one (see docs/ARCHITECTURE.md §4). This
 *       endpoint lets LoginForm still accept a phone number: it looks up
 *       the Firestore profile by phone and returns the real email to sign
 *       in with. Intentionally unauthenticated (called before login) —
 *       returns only a boolean-ish existence + the email, nothing else.
 *       Known limitation: no rate limiting yet, so this is a mild phone
 *       number enumeration surface; acceptable for now given the low
 *       sensitivity, worth revisiting if abuse shows up.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Found — returns the account's email
 *       404:
 *         description: No account with that phone number
 */
export async function POST(request: Request) {
  const { phone } = await request.json();

  if (typeof phone !== "string" || !phone.trim()) {
    return Response.json({ error: "phone is required" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  const snapshot = await adminDb.collection("users").where("phone", "==", normalized).limit(1).get();

  if (snapshot.empty) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const email = snapshot.docs[0].data().email as string | null;
  if (!email) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ email });
}
