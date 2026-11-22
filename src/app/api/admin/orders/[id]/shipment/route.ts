import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { parseShipmentInput } from "@/lib/models/order";
import { clearOrderShipment, setOrderShipment } from "@/lib/shop-orders";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/orders/{id}/shipment:
 *   put:
 *     summary: Set or update the courier details on a paid shop order
 *     description: Requires admin role. The rider sees these on their order page and can track the parcel themselves. `trackingUrl` is optional and must be http(s).
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
 *             required: [courier, trackingNumber]
 *             properties:
 *               courier: { type: string }
 *               trackingNumber: { type: string }
 *               trackingUrl: { type: string }
 *               note: { type: string }
 *     responses:
 *       200:
 *         description: "{ shipment }"
 *       400:
 *         description: Invalid fields, or the order isn't paid
 *       404:
 *         description: Order not found
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const parsed = parseShipmentInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const result = await setOrderShipment(id, parsed.input);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_set_order_shipment",
    targetId: id,
    courier: parsed.input.courier,
    trackingNumber: parsed.input.trackingNumber,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ shipment: result.shipment });
}

/**
 * @swagger
 * /api/admin/orders/{id}/shipment:
 *   delete:
 *     summary: Remove the courier details from an order
 *     description: Requires admin role. Use if they were entered against the wrong order.
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
 *     responses:
 *       200:
 *         description: Removed
 *       404:
 *         description: Order not found
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;

  if (!(await clearOrderShipment(id))) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_cleared_order_shipment",
    targetId: id,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}
