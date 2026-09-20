import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { upsertUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

const FIVE_DAYS_SECONDS = 5 * 24 * 60 * 60;

/**
 * @swagger
 * /api/auth/session:
 *   post:
 *     summary: Establish a session cookie from a Firebase ID token
 *     description: Called right after any client-side Firebase sign-in (email/password, phone, Google) completes. Exchanges the ID token for an httpOnly session cookie — see docs/ARCHITECTURE.md §4.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *               profile:
 *                 type: object
 *                 description: Optional signup-time fields (name/address). Ignored on plain logins.
 *                 properties:
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   pincode:
 *                     type: string
 *                   emergencyContactName:
 *                     type: string
 *                   emergencyContactPhone:
 *                     type: string
 *               rememberMe:
 *                 type: boolean
 *                 description: Defaults to true. When explicitly false, the cookie is set without a Max-Age (cleared when the browser closes) instead of persisting for its full 5-day life.
 *     responses:
 *       200:
 *         description: Session cookie set
 *       401:
 *         description: Invalid ID token
 */
export async function POST(request: Request) {
  const { idToken, profile, rememberMe } = await request.json();

  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ error: "idToken is required" }, { status: 400 });
  }

  try {
    const [sessionCookie, decoded] = await Promise.all([
      createSessionCookie(idToken),
      adminAuth.verifyIdToken(idToken),
    ]);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // "Remember me" unchecked (rememberMe === false) → a browser session
      // cookie (no maxAge) that's discarded when the browser closes, instead
      // of persisting for the underlying session cookie's full 5-day life.
      ...(rememberMe === false ? {} : { maxAge: FIVE_DAYS_SECONDS }),
    });

    // uid/email come from the verified token, never the client-supplied
    // body — a caller can't spoof another account's identity or role here.
    await upsertUserProfile(
      { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined },
      profile
    );

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }
}

/**
 * @swagger
 * /api/auth/session:
 *   delete:
 *     summary: Clear the session cookie (log out)
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Session cookie cleared
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
