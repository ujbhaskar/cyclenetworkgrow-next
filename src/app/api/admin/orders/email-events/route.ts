import { requireRole } from "@/lib/auth/dal";
import { brevoConfigured, fetchEmailEvents } from "@/lib/brevo";
import type { EmailEvent } from "@/lib/models/email-activity";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/orders/email-events:
 *   get:
 *     summary: Delivery status of shop order emails, from Brevo (admin only)
 *     description: Events from the last 90 days, grouped by the order number in the email's subject.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ configured, byOrder }"
 *       502:
 *         description: Brevo couldn't be read
 */
export async function GET() {
  await requireRole("admin");
  if (!brevoConfigured()) return Response.json({ configured: false });

  try {
    const byOrder: Record<string, EmailEvent[]> = {};
    for (const event of await fetchEmailEvents()) {
      const orderNumber = event.subject.match(/\bCNG-\d+\b/)?.[0];
      if (orderNumber) (byOrder[orderNumber] ??= []).push(event);
    }
    return Response.json({ configured: true, byOrder });
  } catch (err) {
    console.error("[brevo] couldn't read email events:", err);
    return Response.json({ error: "Couldn't read email status from Brevo." }, { status: 502 });
  }
}
