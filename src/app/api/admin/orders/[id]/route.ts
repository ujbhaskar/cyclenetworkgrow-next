import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import { parseShipToInput } from "@/lib/models/order";
import { cancelOrder, deleteOrder, setOrderFlag, setOrderPinned, updateOrderShipTo } from "@/lib/shop-orders";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/orders/{id}:
 *   patch:
 *     summary: Edit a shop order's delivery address, flag it, or pin it
 *     description: >
 *       Requires admin role. Any combination of `shipTo` (full replacement of the delivery
 *       details), `flag` (`{ reason }` to flag, or `null` to clear) and `pinned` (boolean).
 *       Changes are recorded in the audit log; address edits log the before and after.
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
 *             properties:
 *               shipTo:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   phone: { type: string }
 *                   email: { type: string }
 *                   address: { type: string }
 *                   city: { type: string }
 *                   state: { type: string }
 *                   pincode: { type: string }
 *               flag:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   reason: { type: string }
 *               pinned: { type: boolean }
 *     responses:
 *       200:
 *         description: The fields that changed
 *       400:
 *         description: Invalid fields
 *       404:
 *         description: Order not found
 *       409:
 *         description: The order is unpaid and still inside its 15-minute payment window (address edits are locked until it closes)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  // Validate everything first so a bad field doesn't leave the order half-updated.
  let shipTo: ReturnType<typeof parseShipToInput> | null = null;
  if ("shipTo" in body) {
    shipTo = parseShipToInput(body.shipTo, INDIAN_STATES_AND_UTS);
    if (!shipTo.ok) return Response.json({ error: shipTo.error }, { status: 400 });
  }
  let flagReason: string | null | undefined;
  if ("flag" in body) {
    if (body.flag === null) {
      flagReason = null;
    } else {
      const reason = typeof body.flag?.reason === "string" ? body.flag.reason.trim() : "";
      if (!reason) return Response.json({ error: "Give a reason for the flag" }, { status: 400 });
      if (reason.length > 200) return Response.json({ error: "Reason must be under 200 characters" }, { status: 400 });
      flagReason = reason;
    }
  }
  if ("pinned" in body && typeof body.pinned !== "boolean") {
    return Response.json({ error: "pinned must be true or false" }, { status: 400 });
  }
  if (!shipTo && flagReason === undefined && !("pinned" in body)) {
    return Response.json({ error: "Nothing to change" }, { status: 400 });
  }

  const result: Record<string, unknown> = {};
  const audit = async (action: string, extra: Record<string, unknown> = {}) => {
    await adminDb.collection("auditLog").add({
      actorUid: session.uid,
      action,
      targetId: id,
      ...extra,
      timestamp: new Date().toISOString(),
    });
  };

  if (shipTo?.ok) {
    const changed = await updateOrderShipTo(id, shipTo.shipTo);
    if (!changed.ok) return Response.json({ error: changed.error }, { status: changed.status });
    result.shipTo = changed.after;
    await audit("admin_edited_order_address", { before: changed.before, after: changed.after });
  }
  if (flagReason !== undefined) {
    const flag = await setOrderFlag(id, flagReason);
    if (flag === undefined) return Response.json({ error: "Order not found" }, { status: 404 });
    result.flag = flag;
    await audit(flag ? "admin_flagged_order" : "admin_unflagged_order", flag ? { reason: flag.reason } : {});
  }
  if ("pinned" in body) {
    if (!(await setOrderPinned(id, body.pinned))) return Response.json({ error: "Order not found" }, { status: 404 });
    result.pinned = body.pinned;
    await audit(body.pinned ? "admin_pinned_order" : "admin_unpinned_order");
  }

  return Response.json(result);
}

/**
 * @swagger
 * /api/admin/orders/{id}:
 *   delete:
 *     summary: Permanently delete a shop order
 *     description: >
 *       Requires admin role. Irreversible, and only allowed 7 days after the order was placed
 *       (before that, cancel it). Deleting a PAID order does not refund the payment — refund it
 *       in the Razorpay dashboard. A full copy of the order is kept in the audit log.
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
 *         description: Deleted
 *       400:
 *         description: The order is less than 7 days old
 *       404:
 *         description: Order not found
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;

  const result = await deleteOrder(id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  const deleted = result.order;
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_order",
    targetId: id,
    orderNumber: deleted.orderNumber,
    wasPaid: deleted.status === "paid",
    // Everything needed to recreate the record if this was a mistake.
    deletedOrder: deleted,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}

/**
 * @swagger
 * /api/admin/orders/{id}:
 *   post:
 *     summary: Cancel a shop order
 *     description: >
 *       Requires admin role. An unpaid order can only be acted on once its 15-minute payment window has
 *       closed (the rider may be paying). An unpaid order has its Razorpay payment link closed. A paid order is
 *       only marked cancelled — the payment is NOT refunded automatically; refund it in the Razorpay
 *       dashboard. An order that has courier details can't be cancelled until they're removed. The
 *       order stays in the list with a Cancelled status, which the rider also sees.
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: "{ status: cancelled, wasPaid: boolean, cancelReason }"
 *       400:
 *         description: Already cancelled/expired, or already shipped
 *       404:
 *         description: Order not found
 *       409:
 *         description: The order is still inside its 15-minute payment window, or the rider paid at the last moment
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";

  const result = await cancelOrder(id, reason || null);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_cancelled_order",
    targetId: id,
    orderNumber: result.order.orderNumber,
    wasPaid: result.wasPaid,
    reason: reason || null,
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    status: "cancelled",
    wasPaid: result.wasPaid,
    cancelReason: result.order.cancelReason,
    cancelledAt: result.order.cancelledAt,
  });
}
