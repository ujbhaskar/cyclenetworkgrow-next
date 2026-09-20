import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { getRideRulesConfig, updateRideRulesConfig } from "@/lib/ride-rules";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/ride-rules:
 *   get:
 *     summary: Current admin-configured ride-qualification rules
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: RideRulesConfig
 */
export async function GET() {
  await requireRole("admin");
  const config = await getRideRulesConfig();
  return Response.json(config);
}

/**
 * @swagger
 * /api/admin/ride-rules:
 *   put:
 *     summary: Update the ride-qualification rules
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid values
 */
export async function PUT(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  const elapsedToMovingRatioMax = Number(body?.elapsedToMovingRatioMax);
  const minRideDistanceKm = Number(body?.minRideDistanceKm);
  const maxVirtualRideDistanceKm = Number(body?.maxVirtualRideDistanceKm);
  const missingRidesDefaultAfterDate = String(body?.missingRidesDefaultAfterDate ?? "");

  if (
    !Number.isFinite(elapsedToMovingRatioMax) ||
    elapsedToMovingRatioMax <= 0 ||
    !Number.isFinite(minRideDistanceKm) ||
    minRideDistanceKm < 0 ||
    !Number.isFinite(maxVirtualRideDistanceKm) ||
    maxVirtualRideDistanceKm < 0
  ) {
    return Response.json({ error: "All three values must be positive numbers" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(missingRidesDefaultAfterDate)) {
    return Response.json({ error: "Activities-after date must be a valid date" }, { status: 400 });
  }

  const config = { elapsedToMovingRatioMax, minRideDistanceKm, maxVirtualRideDistanceKm, missingRidesDefaultAfterDate };
  await updateRideRulesConfig(config, session.uid);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_updated_ride_rules",
    changes: config,
    timestamp: new Date().toISOString(),
  });

  return Response.json(config);
}
