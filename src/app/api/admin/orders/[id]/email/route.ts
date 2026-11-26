import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { RESENDABLE_EMAILS, type ResendableEmail } from "@/lib/models/email-activity";
import { getOrder } from "@/lib/shop-orders";
import { resendBuyerEmail } from "@/lib/shop-notifications";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/orders/{id}/email:
 *   post:
 *     summary: Resend one of an order's emails to the buyer (admin only)
 *     description: Goes to the buyer only, at the order's current email address. The shop mailbox isn't copied.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [confirmation, shipment, cancellation] }
 *     responses:
 *       200:
 *         description: "{ to }"
 *       400:
 *         description: That email doesn't apply to this order, or the buyer has no email
 *       404:
 *         description: Order not found
 *       502:
 *         description: The mail server didn't accept it
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  const type = RESENDABLE_EMAILS.find((t): t is ResendableEmail => t === body?.type);
  if (!type) return Response.json({ error: "Unknown email type" }, { status: 400 });

  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const result = await resendBuyerEmail(order, type);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_resent_order_email",
    targetId: id,
    emailType: type,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ to: result.to });
}
