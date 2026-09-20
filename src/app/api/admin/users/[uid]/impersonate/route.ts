import { requireRole } from "@/lib/auth/dal";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ uid: string }> };

/**
 * @swagger
 * /api/admin/users/{uid}/impersonate:
 *   post:
 *     summary: Get a one-time custom token to sign in as this rider
 *     description: >
 *       Requires admin role. Returns a Firebase custom token the client exchanges for a
 *       real session as the target user (see components/admin/ImpersonateButton.tsx) —
 *       used for support/debugging (e.g. "what does this rider actually see"). The
 *       resulting session carries an `impersonatedBy` claim so the site can show an
 *       "end impersonation" banner and every action is traceable back to the admin who
 *       started it. Refuses to impersonate another admin.
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
 *         description: "{ customToken: string }"
 *       400:
 *         description: Can't impersonate this account
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { uid } = await params;

  if (uid === session.uid) {
    return Response.json({ error: "You can't impersonate your own account." }, { status: 400 });
  }

  const target = await getUserProfile(uid);
  if (!target) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  if (target.role === "admin") {
    return Response.json({ error: "Can't impersonate another admin account." }, { status: 400 });
  }

  const customToken = await adminAuth.createCustomToken(uid, { impersonatedBy: session.uid });

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_started_impersonation",
    targetUid: uid,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ customToken });
}
