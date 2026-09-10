import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { createUserByAdmin, listAllUsers } from "@/lib/admin-user-management";
import { ROLES, type Role } from "@/lib/models/user";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     description: Requires admin role. Returns every rider/manager/admin profile.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: List of user profiles
 */
export async function GET() {
  await requireRole("admin");
  const users = await listAllUsers();
  return Response.json({ users });
}

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a user account with a role
 *     description: Admin-driven creation — for onboarding riders/managers/admins directly, with a password to relay offline. Requires admin role.
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
 *             required: [identifier, role]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or phone number.
 *               password:
 *                 type: string
 *                 description: Optional — a random password is generated if omitted.
 *               role:
 *                 type: string
 *                 enum: [rider, manager, admin]
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Created — response includes the plaintext password to relay to the user.
 *       400:
 *         description: Missing/invalid fields
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json();
  const { identifier, password, role, firstName, lastName, address } = body;

  if (typeof identifier !== "string" || !identifier.trim()) {
    return Response.json({ error: "identifier is required" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return Response.json({ error: `role must be one of: ${ROLES.join(", ")}` }, { status: 400 });
  }

  const result = await createUserByAdmin({
    identifier: identifier.trim(),
    password: typeof password === "string" ? password : undefined,
    role: role as Role,
    firstName: typeof firstName === "string" ? firstName : undefined,
    lastName: typeof lastName === "string" ? lastName : undefined,
    address: typeof address === "string" ? address : undefined,
  });

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_created_user",
    targetUid: result.uid,
    targetIdentifier: identifier.trim(),
    role,
    timestamp: new Date().toISOString(),
  });

  return Response.json(result);
}
