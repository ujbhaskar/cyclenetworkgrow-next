import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { ORDER_STATUSES, canDeleteOrder, deletableFrom, isPaymentWindowOpen, paymentDeadline, paymentWindowMessage, orderItemKey, type OrderFlag, type OrderItem, type OrderStatus, type OrderShipTo, type OrderShipment, type ShipmentInput, type ShopOrder } from "@/lib/models/order";
import { removeOrderedFromCart } from "@/lib/shop-cart";
import { cancelRazorpayPaymentLink, fetchRazorpayPaymentDetails, fetchRazorpayPaymentLink } from "@/lib/razorpay";
import { notifyOrderPaid } from "@/lib/shop-notifications";

// Own collections (not generic names) — challenge1177's Firestore is shared
// with the legacy letscng app.
const ORDERS = "shopOrders";
const COUNTER = "shopCounters/orders";
const ORDER_NUMBER_START = 1001;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOrder(id: string, d: FirebaseFirestore.DocumentData): ShopOrder {
  const ship = (d.shipTo ?? {}) as Record<string, unknown>;
  return {
    id,
    orderNumber: str(d.orderNumber),
    uid: str(d.uid),
    items: toItems(d),
    amount: typeof d.amount === "number" ? d.amount : 0,
    status: ORDER_STATUSES.includes(d.status) ? (d.status as OrderStatus) : "created",
    shipTo: {
      name: str(ship.name),
      phone: str(ship.phone),
      email: str(ship.email),
      address: str(ship.address),
      city: str(ship.city),
      state: str(ship.state),
      pincode: str(ship.pincode),
    },
    paymentLinkId: str(d.paymentLinkId) || null,
    paymentLinkUrl: str(d.paymentLinkUrl) || null,
    razorpayPaymentId: str(d.razorpayPaymentId) || null,
    paymentMethod: str(d.paymentMethod) || null,
    paidAt: str(d.paidAt) || null,
    cancelledAt: str(d.cancelledAt) || null,
    cancelReason: str(d.cancelReason) || null,
    shipment: toShipment(d.shipment),
    origin: str(d.origin),
    pinned: d.pinned === true,
    flag: toFlag(d.flag),
    createdAt: str(d.createdAt),
  };
}

function toItems(d: FirebaseFirestore.DocumentData): OrderItem[] {
  const opt = (v: unknown) => (typeof v === "string" && v ? v : null);
  if (Array.isArray(d.items)) {
    return d.items.map((raw: Record<string, unknown>) => ({
      productId: str(raw.productId),
      productTitle: str(raw.productTitle),
      productImage: opt(raw.productImage),
      color: opt(raw.color),
      size: opt(raw.size),
      sleeve: opt(raw.sleeve),
      unitPrice: typeof raw.unitPrice === "number" ? raw.unitPrice : 0,
      qty: typeof raw.qty === "number" && raw.qty > 0 ? raw.qty : 1,
    }));
  }
  // Orders from before the cart existed held exactly one product, one unit.
  return [
    {
      productId: str(d.productId),
      productTitle: str(d.productTitle),
      productImage: opt(d.productImage),
      color: opt(d.color),
      size: opt(d.size),
      sleeve: opt(d.sleeve),
      unitPrice: typeof d.amount === "number" ? d.amount : 0,
      qty: 1,
    },
  ];
}

function toFlag(raw: unknown): OrderFlag | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  return str(f.reason) ? { reason: str(f.reason), flaggedAt: str(f.flaggedAt) } : null;
}

function toShipment(raw: unknown): OrderShipment | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!str(s.courier) || !str(s.trackingNumber)) return null;
  return {
    courier: str(s.courier),
    trackingNumber: str(s.trackingNumber),
    trackingUrl: str(s.trackingUrl) || null,
    note: str(s.note) || null,
    shippedAt: str(s.shippedAt),
  };
}

const newestFirst = (a: ShopOrder, b: ShopOrder) => b.createdAt.localeCompare(a.createdAt);

/** Creates the order record (status "created", no payment link yet) and
 * assigns its sequential order number atomically. */
export async function createPendingOrder(input: {
  uid: string;
  items: OrderItem[];
  amount: number;
  shipTo: OrderShipTo;
  origin: string;
}): Promise<{ id: string; orderNumber: string }> {
  const counterRef = adminDb.doc(COUNTER);
  const orderRef = adminDb.collection(ORDERS).doc();

  const orderNumber = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = typeof snap.data()?.next === "number" ? (snap.data()!.next as number) : ORDER_NUMBER_START;
    const number = `CNG-${next}`;
    tx.set(counterRef, { next: next + 1 });
    tx.set(orderRef, {
      ...input,
      orderNumber: number,
      status: "created",
      paymentLinkId: null,
      paymentLinkUrl: null,
      razorpayPaymentId: null,
      paymentMethod: null,
      paidAt: null,
      cancelledAt: null,
      cancelReason: null,
      shipment: null,
      pinned: false,
      flag: null,
      createdAt: new Date().toISOString(),
    });
    return number;
  });

  return { id: orderRef.id, orderNumber };
}

export async function attachPaymentLink(orderId: string, link: { id: string; url: string }): Promise<void> {
  await adminDb.collection(ORDERS).doc(orderId).update({ paymentLinkId: link.id, paymentLinkUrl: link.url });
}

export async function getOrder(id: string): Promise<ShopOrder | null> {
  const doc = await adminDb.collection(ORDERS).doc(id).get();
  return doc.exists ? toOrder(doc.id, doc.data() ?? {}) : null;
}

export async function listOrdersForUser(uid: string): Promise<ShopOrder[]> {
  const snapshot = await adminDb.collection(ORDERS).where("uid", "==", uid).get();
  return snapshot.docs.map((doc) => toOrder(doc.id, doc.data())).sort(newestFirst);
}

export async function listAllOrders(): Promise<ShopOrder[]> {
  const snapshot = await adminDb.collection(ORDERS).get();
  return snapshot.docs.map((doc) => toOrder(doc.id, doc.data())).sort(newestFirst);
}

/** Idempotent — a second call (callback + page-load self-heal racing) is a no-op,
 * including the cart clean-up, which runs only on the one call that actually
 * flips the order to paid. */
export async function markOrderPaid(orderId: string, razorpayPaymentId: string): Promise<void> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  if (!(await ref.get()).exists) return;

  const details = await fetchRazorpayPaymentDetails(razorpayPaymentId);
  const flipped = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // A payment that lands after we marked the order expired is still real money — honour it.
    const status = snap.data()?.status;
    if (!snap.exists || status === "paid" || status === "cancelled") return null;
    tx.update(ref, {
      status: "paid",
      razorpayPaymentId,
      paymentMethod: details?.method ?? null,
      paidAt: details?.paidAt ?? new Date().toISOString(),
    });
    return toOrder(snap.id, snap.data() ?? {});
  });

  if (flipped) {
    await removeOrderedFromCart(flipped.uid, flipped.items).catch((err) =>
      console.error("[shop-orders] cart clean-up failed:", err),
    );
    // Email the buyer and the admins. Never blocks or fails the payment.
    const paid = await getOrder(orderId);
    if (paid) await notifyOrderPaid(paid).catch((err) => console.error("[shop-orders] notification failed:", err));
  }
}

/**
 * Brings an unpaid order up to date. Asks Razorpay directly whether its payment
 * link was paid (so a payment made in another tab, or whose redirect back never
 * landed, still counts) and, if the order is past its payment window and still
 * unpaid, expires it and closes the link so it can't be paid afterwards.
 *
 * Called whenever orders are viewed — that's what makes "expires after 15
 * minutes" take effect without a scheduled job; Razorpay itself also refuses
 * payment on the link once its own expiry passes.
 */
export async function syncOrderPayment(order: ShopOrder): Promise<ShopOrder> {
  if (order.status !== "created") return order;

  const stale = Date.now() > paymentDeadline(order);
  try {
    if (order.paymentLinkId) {
      const link = await fetchRazorpayPaymentLink(order.paymentLinkId);
      if (link.status === "paid" && link.paymentId) {
        await markOrderPaid(order.id, link.paymentId);
        return (await getOrder(order.id)) ?? order;
      }
      if (link.status === "expired" || link.status === "cancelled") {
        return (await expireOrder(order.id)) ?? order;
      }
    }
    if (stale) {
      // Close the link first; if Razorpay says no it may have just been paid — re-check.
      const closed = order.paymentLinkId ? await cancelRazorpayPaymentLink(order.paymentLinkId) : true;
      if (!closed && order.paymentLinkId) {
        const link = await fetchRazorpayPaymentLink(order.paymentLinkId);
        if (link.status === "paid" && link.paymentId) {
          await markOrderPaid(order.id, link.paymentId);
          return (await getOrder(order.id)) ?? order;
        }
      }
      return (await expireOrder(order.id)) ?? order;
    }
  } catch (err) {
    console.error("[shop-orders] couldn't sync payment status:", err);
  }
  return order;
}

/** created -> expired, only if it's still "created" (never overwrites a paid order). */
async function expireOrder(orderId: string): Promise<ShopOrder | null> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data()?.status === "created") tx.update(ref, { status: "expired" });
  });
  return getOrder(orderId);
}

/** The rider's most recent unpaid order with exactly these items (same
 * products, options and quantities) and total, which already has a payment
 * page — so abandoning checkout (Back button) and paying again reuses it
 * instead of piling up pending duplicates. */
export async function findReusableOrder(uid: string, items: OrderItem[], amount: number): Promise<ShopOrder | null> {
  const signature = (list: OrderItem[]) =>
    list
      .map((i) => `${orderItemKey(i)}x${i.qty}@${i.unitPrice}`)
      .sort()
      .join(";");
  const wanted = signature(items);
  const orders = await listOrdersForUser(uid);
  return (
    orders.find(
      (o) => o.status === "created" && Date.now() < paymentDeadline(o) && o.paymentLinkId && o.paymentLinkUrl && o.amount === amount && signature(o.items) === wanted,
    ) ?? null
  );
}

/** Sets (or replaces) the courier details. Only paid orders can be shipped.
 * Keeps the original shippedAt when an admin merely corrects a typo. */
export async function setOrderShipment(
  orderId: string,
  input: ShipmentInput,
): Promise<{ ok: true; shipment: OrderShipment; previous: OrderShipment | null } | { ok: false; error: string; status: number }> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, error: "Order not found", status: 404 };
  if (doc.data()?.status !== "paid") {
    return { ok: false, error: "Only paid orders can be shipped (cancelled and expired orders can't)", status: 400 };
  }
  const shipment: OrderShipment = {
    ...input,
    shippedAt: toShipment(doc.data()?.shipment)?.shippedAt || new Date().toISOString(),
  };
  await ref.update({ shipment });
  return { ok: true, shipment, previous: toShipment(doc.data()?.shipment) };
}

export async function clearOrderShipment(orderId: string): Promise<boolean> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  if (!(await ref.get()).exists) return false;
  await ref.update({ shipment: FieldValue.delete() });
  return true;
}

// ---- admin order management -------------------------------------------------

/** Replaces the delivery details. Returns the previous ones for the audit log.
 * Refused while an unpaid order can still be paid (the rider may be paying). */
export async function updateOrderShipTo(
  orderId: string,
  shipTo: OrderShipTo,
): Promise<{ ok: true; before: OrderShipTo; after: OrderShipTo } | { ok: false; error: string; status: number }> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, error: "Order not found", status: 404 };
  const order = toOrder(doc.id, doc.data() ?? {});
  if (isPaymentWindowOpen(order)) {
    return { ok: false, error: paymentWindowMessage(order), status: 409 };
  }
  await ref.update({ shipTo });
  return { ok: true, before: order.shipTo, after: shipTo };
}

export async function setOrderFlag(orderId: string, reason: string | null): Promise<OrderFlag | null | undefined> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  if (!(await ref.get()).exists) return undefined; // order not found
  if (reason === null) {
    await ref.update({ flag: FieldValue.delete() });
    return null;
  }
  const flag: OrderFlag = { reason, flaggedAt: new Date().toISOString() };
  await ref.update({ flag });
  return flag;
}

export async function setOrderPinned(orderId: string, pinned: boolean): Promise<boolean> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  if (!(await ref.get()).exists) return false;
  await ref.update({ pinned });
  return true;
}

/** Deletes the order and returns what it contained, so the caller can keep a
 * copy in the audit log (deletion itself is permanent). Only allowed once the
 * order is DELETE_AFTER_DAYS old — before that an admin should cancel it. */
export async function deleteOrder(
  orderId: string,
): Promise<{ ok: true; order: ShopOrder } | { ok: false; error: string; status: number }> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, error: "Order not found", status: 404 };
  const order = toOrder(doc.id, doc.data() ?? {});
  if (!canDeleteOrder(order)) {
    const when = new Date(deletableFrom(order)).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
    return { ok: false, error: `An order can only be removed 7 days after it was placed (from ${when}). Cancel it instead.`, status: 400 };
  }
  await ref.delete();
  return { ok: true, order };
}

/**
 * Admin cancellation. An unpaid order has its payment link closed first, so it
 * can't be paid afterwards. A PAID order is only marked cancelled here — the
 * money is NOT sent back; refund it in the Razorpay dashboard. An order that's
 * already shipped can't be cancelled until its courier details are removed.
 */
export async function cancelOrder(
  orderId: string,
  reason: string | null,
): Promise<{ ok: true; order: ShopOrder; wasPaid: boolean } | { ok: false; error: string; status: number }> {
  const ref = adminDb.collection(ORDERS).doc(orderId);
  let order = await getOrder(orderId);
  if (!order) return { ok: false, error: "Order not found", status: 404 };

  if (order.status === "created") order = await syncOrderPayment(order); // maybe it was just paid / already expired
  if (isPaymentWindowOpen(order)) {
    return { ok: false, error: paymentWindowMessage(order), status: 409 };
  }
  if (order.status === "cancelled") return { ok: false, error: "This order is already cancelled", status: 400 };
  if (order.status === "expired") return { ok: false, error: "This order already expired unpaid", status: 400 };
  if (order.shipment) {
    return { ok: false, error: "This order has courier details. Remove them first if it hasn't really shipped.", status: 400 };
  }

  const wasPaid = order.status === "paid";
  if (!wasPaid && order.paymentLinkId) {
    const closed = await cancelRazorpayPaymentLink(order.paymentLinkId);
    if (!closed) {
      // Razorpay wouldn't close it — most likely paid in the last moment.
      const synced = await syncOrderPayment(order);
      if (synced.status === "paid") {
        return { ok: false, error: "The rider just paid for this order. Open it again to cancel the paid order.", status: 409 };
      }
    }
  }

  await ref.update({ status: "cancelled", cancelledAt: new Date().toISOString(), cancelReason: reason });
  const updated = (await getOrder(orderId)) ?? order;
  return { ok: true, order: updated, wasPaid };
}
