import { requireRole } from "@/lib/auth/dal";
import { createEvent, listAllEvents } from "@/lib/events";
import { adminDb } from "@/lib/firebase/admin";
import { EVENT_DIFFICULTIES, EVENT_STATUSES } from "@/lib/models/event";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/events:
 *   get:
 *     summary: List all events
 *     description: Requires admin role.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: List of events
 */
export async function GET() {
  await requireRole("admin");
  const events = await listAllEvents();
  return Response.json({ events });
}

/**
 * @swagger
 * /api/admin/events:
 *   post:
 *     summary: Create an event
 *     description: Requires admin role.
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
 *             required: [name, category, startDate, endDate, location, distanceKm, difficulty, status]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               startDate: { type: string }
 *               endDate: { type: string }
 *               location: { type: string }
 *               distanceKm: { type: number }
 *               difficulty: { type: string, enum: [Beginner, Intermediate, Advanced] }
 *               status: { type: string, enum: [draft, active, completed, archived] }
 *     responses:
 *       200:
 *         description: Created event
 *       400:
 *         description: Invalid fields
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json();
  const { name, description, category, startDate, endDate, location, distanceKm, difficulty, status } = body;

  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return Response.json({ error: "startDate and endDate are required" }, { status: 400 });
  }
  if (!EVENT_DIFFICULTIES.includes(difficulty)) {
    return Response.json({ error: `difficulty must be one of: ${EVENT_DIFFICULTIES.join(", ")}` }, { status: 400 });
  }
  if (!EVENT_STATUSES.includes(status)) {
    return Response.json({ error: `status must be one of: ${EVENT_STATUSES.join(", ")}` }, { status: 400 });
  }

  const event = await createEvent(
    {
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      category: typeof category === "string" ? category : "Road",
      startDate,
      endDate,
      location: typeof location === "string" ? location : "",
      distanceKm: Number(distanceKm) || 0,
      difficulty,
      status,
    },
    session.uid
  );

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_created_event",
    targetId: event.id,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ event });
}
