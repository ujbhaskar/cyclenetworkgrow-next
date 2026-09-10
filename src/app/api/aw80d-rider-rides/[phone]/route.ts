import { getAw80dRiderRides } from "@/lib/aw80d";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ phone: string }> };

/**
 * @swagger
 * /api/aw80d-rider-rides/{phone}:
 *   get:
 *     summary: List one AW80D rider's qualifying rides
 *     description: Public verification endpoint, same purpose as /api/rider-rides/{phone} but using AW80D's own qualifying rules (20km minimum, elapsed-time check, no tagged rides) instead of the 1177 event's.
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

  const rides = await getAw80dRiderRides(phone, start, end);
  return Response.json({ rides });
}
