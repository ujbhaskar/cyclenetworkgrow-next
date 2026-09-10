import { getRiderRides } from "@/lib/rider-metrics";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ phone: string }> };

/**
 * @swagger
 * /api/rider-rides/{phone}:
 *   get:
 *     summary: List one rider's qualifying rides for the current leaderboard window
 *     description: Public verification endpoint backing the leaderboard's "view rides" modal — anyone can confirm which Strava-synced activities produced a rider's milestone counts and total distance. Same qualifying criteria as the leaderboard (Ride/VirtualRide, not flagged, within the demo date window).
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { phone } = await params;
  const rides = await getRiderRides(phone);
  return Response.json({ rides });
}
