import { requireRole } from "@/lib/auth/dal";
import { fetchCandidateRides } from "@/lib/admin-missing-rides";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/rides/missing/fetch:
 *   post:
 *     summary: Preview a rider's Strava activities that aren't yet synced
 *     description: Fetches directly from Strava's API server-side (never the client-secret-in-the-browser pattern the legacy admin used) and filters to qualifying rides (Ride/VirtualRide, not manual/tagged, above the given minimum distance). Nothing is written — see /sync.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ athleteId: string, phone: string, activities: CandidateActivity[] }"
 *       400:
 *         description: Fetch failed (e.g. rider hasn't connected Strava)
 */
export async function POST(request: Request) {
  await requireRole("admin");
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const athleteId = typeof body?.athleteId === "string" ? body.athleteId.trim() : "";
  const minDistanceKm = Number(body?.minDistanceKm ?? 20);
  const afterDate = typeof body?.afterDate === "string" ? body.afterDate : "";

  if ((!phone && !athleteId) || !afterDate) {
    return Response.json({ error: "phone or athleteId, and afterDate, are required" }, { status: 400 });
  }

  try {
    const result = await fetchCandidateRides(
      athleteId ? { athleteId } : { phone },
      minDistanceKm,
      afterDate,
    );
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Fetch failed" }, { status: 400 });
  }
}
