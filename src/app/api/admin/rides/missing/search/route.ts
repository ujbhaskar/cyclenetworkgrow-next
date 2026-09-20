import { requireRole } from "@/lib/auth/dal";
import { searchRiders } from "@/lib/admin-missing-rides";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/rides/missing/search:
 *   get:
 *     summary: Search Strava-connected riders by name, location, and/or state
 *     description: Case-insensitive substring match on name/location, exact match on state — any combination, at least one required — capped to 20 results. Lets an admin find the right rider before pulling their missing rides without already knowing their phone or athlete id.
 *     tags:
 *       - Admin
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
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
  const riders = await searchRiders({
    name: searchParams.get("q") ?? "",
    location: searchParams.get("location") ?? "",
    state: searchParams.get("state") ?? "",
  });
  return Response.json({ riders });
}
