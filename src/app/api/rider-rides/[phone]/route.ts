import { getRiderRides } from "@/lib/rider-metrics";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ phone: string }> };

/**
 * @swagger
 * /api/rider-rides/{phone}:
 *   get:
 *     summary: List one rider's qualifying rides for the given event window
 *     description: Public verification endpoint backing the leaderboard's "view rides" modal — anyone can confirm which Strava-synced activities produced a rider's milestone counts and total distance. Same qualifying criteria as the leaderboard (Ride/VirtualRide, not flagged, within the event's date window).
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { phone } = await params;
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return Response.json({ error: "start and end query params are required" }, { status: 400 });
  }

  const rides = await getRiderRides(phone, start, end);
  return Response.json({ rides });
}
