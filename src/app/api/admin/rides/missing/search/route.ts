import { requireRole } from "@/lib/auth/dal";
import { searchRidersByName } from "@/lib/admin-missing-rides";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/rides/missing/search:
 *   get:
 *     summary: Search Strava-connected riders by name
 *     description: Case-insensitive substring match over first+last name, capped to 20 results — lets an admin find the right rider before pulling their missing rides without already knowing their phone or athlete id.
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
  const riders = await searchRidersByName(query);
  return Response.json({ riders });
}
