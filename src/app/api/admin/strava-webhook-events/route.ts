import { requireRole } from "@/lib/auth/dal";
import { listStravaWebhookEvents } from "@/lib/strava-webhook-events";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;

/**
 * @swagger
 * /api/admin/strava-webhook-events:
 *   get:
 *     summary: Newest-first page of the raw Strava webhook audit log
 *     tags:
 *       - Admin
 *       - Strava
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Previous page's nextCursor (an ISO receivedAt) — omit for the first page.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: ownerId
 *         schema:
 *           type: string
 *         description: Strava athlete id — exact match.
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: ISO datetime — only events received at or after this.
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: ISO datetime — only events received at or before this.
 *     responses:
 *       200:
 *         description: "{ events: [...], nextCursor: string | null }"
 */
export async function GET(request: Request) {
  await requireRole("admin");

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, MAX_LIMIT);
  const ownerId = url.searchParams.get("ownerId") || undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const page = await listStravaWebhookEvents(cursor, limit, { ownerId, from, to });
  return Response.json(page);
}
