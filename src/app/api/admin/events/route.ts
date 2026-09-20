import { requireRole } from "@/lib/auth/dal";
import { createEvent, listAllEventsForAdmin } from "@/lib/events";
import { adminDb } from "@/lib/firebase/admin";
import { EVENT_CATEGORIES, EVENT_STATUSES, EVENT_TYPES, type EventInput } from "@/lib/models/event";

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
  const events = await listAllEventsForAdmin();
  return Response.json({ events });
}

/**
 * @swagger
 * /api/admin/events:
 *   post:
 *     summary: Create an event
 *     description: Requires admin role. Same core schema the legacy Angular admin's add-event form uses.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ id: string }"
 *       400:
 *         description: Invalid fields
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  if (typeof body?.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.startDate || !body.endDate) {
    return Response.json({ error: "startDate and endDate are required" }, { status: 400 });
  }
  if (!EVENT_CATEGORIES.includes(body.category)) {
    return Response.json({ error: `category must be one of: ${EVENT_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  if (!EVENT_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${EVENT_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (!EVENT_TYPES.includes(body.eventType)) {
    return Response.json({ error: `eventType must be one of: ${EVENT_TYPES.join(", ")}` }, { status: 400 });
  }

  const input: EventInput = {
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description : "",
    image: typeof body.image === "string" ? body.image : "",
    startDate: body.startDate,
    endDate: body.endDate,
    registrationStartDate: typeof body.registrationStartDate === "string" ? body.registrationStartDate : "",
    registrationEndDate: typeof body.registrationEndDate === "string" ? body.registrationEndDate : "",
    path: typeof body.path === "string" ? body.path : "",
    category: body.category,
    publish: Boolean(body.publish),
    rules: typeof body.rules === "string" ? body.rules : "",
    payment_link: typeof body.payment_link === "string" ? body.payment_link : "",
    distance: typeof body.distance === "string" ? body.distance : "",
    minDistance: typeof body.minDistance === "string" ? body.minDistance : "",
    metrics: typeof body.metrics === "string" ? body.metrics : "",
    eventType: body.eventType,
    status: body.status,
    bannerMessage: typeof body.bannerMessage === "string" ? body.bannerMessage : "",
  };

  const event = await createEvent(input);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_created_event",
    targetId: event.id,
    timestamp: new Date().toISOString(),
  });

  return Response.json(event);
}
