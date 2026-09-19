import { requireRole } from "@/lib/auth/dal";
import { searchRidersForFlagging } from "@/lib/admin-ride-flagging";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/rides/flag/search:
 *   get:
 *     summary: Search Strava-connected riders by name, city, or phone
 *     tags:
 *       - Admin
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ riders: RiderSearchResult[] }"
 */
export async function GET(request: Request) {
  await requireRole("admin");
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const riders = await searchRidersForFlagging(query);
  return Response.json({ riders });
}
