import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { getEventChatConfig, updateEventChatConfig, getRecentChatUsage } from "@/lib/event-chat-limits";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/event-chat/config:
 *   get:
 *     summary: Event chatbot's on/off switch, daily message cap, and recent usage
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ config: { enabled, dailyLimit }, usage: { date, count }[] }"
 */
export async function GET() {
  await requireRole("admin");
  const [config, usage] = await Promise.all([getEventChatConfig(), getRecentChatUsage()]);
  return Response.json({ config, usage });
}

/**
 * @swagger
 * /api/admin/event-chat/config:
 *   put:
 *     summary: Turn the event chatbot on/off, or change its daily message cap
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid values
 */
export async function PUT(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  const enabled = Boolean(body?.enabled);
  const dailyLimit = Number(body?.dailyLimit);
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    return Response.json({ error: "Daily limit must be a positive number" }, { status: 400 });
  }

  const config = { enabled, dailyLimit };
  await updateEventChatConfig(config, session.uid);

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_updated_event_chat_config",
    changes: config,
    timestamp: new Date().toISOString(),
  });

  return Response.json(config);
}
