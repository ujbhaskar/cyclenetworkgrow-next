// Shop order shape — no server-only imports so rider/admin client
// components can use the types. Reads/writes live in src/lib/shop-orders.ts.

// created   — waiting for payment (only valid for PAYMENT_WINDOW_MINUTES)
// paid      — Razorpay confirmed the payment
// expired   — never paid within the window; the payment link was cancelled
// cancelled — cancelled by an admin (a paid order still needs a manual refund)
export const ORDER_STATUSES = ["created", "paid", "expired", "cancelled"] as const;

/** How long a rider has to pay before the order (and its Razorpay link) expires. */
export const PAYMENT_WINDOW_MINUTES = 15;
/** Slack on top of the window so a payment made right at the deadline can still be confirmed. */
export const PAYMENT_GRACE_SECONDS = 60;
/** An order can only be deleted this long after it was placed; until then, cancel it instead. */
export const DELETE_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When an unpaid order stops being payable (also the Razorpay link's expiry). */
export function paymentDeadline(order: Pick<ShopOrder, "createdAt">): number {
  return new Date(order.createdAt).getTime() + (PAYMENT_WINDOW_MINUTES * 60 + PAYMENT_GRACE_SECONDS) * 1000;
}

/**
 * True while an unpaid order can still be paid. During this time the rider may
 * be on Razorpay's page, so admins can't cancel or edit the order — it would
 * race with a payment that's about to land.
 */
export function isPaymentWindowOpen(order: Pick<ShopOrder, "status" | "createdAt">, now = Date.now()): boolean {
  return order.status === "created" && now < paymentDeadline(order);
}

/** Message for the admin when they try to act on an order that's still payable. */
export function paymentWindowMessage(order: Pick<ShopOrder, "createdAt">): string {
  const at = new Date(paymentDeadline(order)).toLocaleTimeString("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" });
  return `This order is still within its ${PAYMENT_WINDOW_MINUTES}-minute payment window — the rider may be paying right now. You can act on it after ${at}.`;
}

/** The moment an order becomes deletable, as a timestamp. */
export function deletableFrom(order: Pick<ShopOrder, "createdAt">): number {
  return new Date(order.createdAt).getTime() + DELETE_AFTER_DAYS * DAY_MS;
}

export function canDeleteOrder(order: Pick<ShopOrder, "createdAt">, now = Date.now()): boolean {
  return now >= deletableFrom(order);
}
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderShipTo = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderFlag = { reason: string; flaggedAt: string };

export type OrderShipment = {
  courier: string;
  trackingNumber: string;
  /** Courier's own tracking page — optional; only http(s) URLs are ever stored. */
  trackingUrl: string | null;
  /** Anything extra for the rider, e.g. "Expected by 28 Nov". */
  note: string | null;
  shippedAt: string;
};

export type ShipmentInput = Pick<OrderShipment, "courier" | "trackingNumber" | "trackingUrl" | "note">;

export function parseShipmentInput(
  body: unknown,
): { ok: true; input: ShipmentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const courier = text(b.courier);
  const trackingNumber = text(b.trackingNumber);
  const trackingUrl = text(b.trackingUrl);
  const note = text(b.note);

  if (!courier) return { ok: false, error: "Courier name is required" };
  if (!trackingNumber) return { ok: false, error: "Tracking number is required" };
  if (courier.length > 60 || trackingNumber.length > 60) {
    return { ok: false, error: "Courier and tracking number must be under 60 characters" };
  }
  // Rendered as a link on the rider's page, so only real web URLs — never javascript: etc.
  if (trackingUrl && !/^https?:\/\/[^\s]+$/i.test(trackingUrl)) {
    return { ok: false, error: "Tracking link must start with http:// or https://" };
  }
  if (trackingUrl.length > 500 || note.length > 300) {
    return { ok: false, error: "Tracking link or note is too long" };
  }
  return { ok: true, input: { courier, trackingNumber, trackingUrl: trackingUrl || null, note: note || null } };
}

export type OrderItem = {
  productId: string;
  productTitle: string;
  productImage: string | null;
  color: string | null;
  size: string | null;
  sleeve: string | null;
  /** Whole rupees per unit, snapshotted at order time. */
  unitPrice: number;
  qty: number;
};

export function orderItemOptions(item: Pick<OrderItem, "color" | "size" | "sleeve">): string {
  return [item.color, item.size, item.sleeve].filter(Boolean).join(" · ") || "—";
}

/** Stable identity of an item's product + options, ignoring quantity and price. */
export function orderItemKey(item: Pick<OrderItem, "productId" | "color" | "size" | "sleeve">): string {
  return [item.productId, item.color ?? "", item.size ?? "", item.sleeve ?? ""].map(encodeURIComponent).join("|");
}

export type ShopOrder = {
  /** Firestore doc id — what URLs use. */
  id: string;
  /** Human-friendly sequential id shown to riders and admins, e.g. CNG-1001. */
  orderNumber: string;
  /** The signed-in rider's uid; null for a guest checkout (no account). */
  uid: string | null;
  /** True when the buyer checked out without an account. */
  guest: boolean;
  items: OrderItem[];
  /** Whole rupees — the total of every item, snapshotted at order time (later price edits don't change it). */
  amount: number;
  status: OrderStatus;
  shipTo: OrderShipTo;
  paymentLinkId: string | null;
  /** Razorpay-hosted page where an unpaid order can be paid (or retried). */
  paymentLinkUrl: string | null;
  razorpayPaymentId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Set by the admin once the parcel is handed to a courier. */
  shipment: OrderShipment | null;
  /** The site's public origin when the order was placed — emails link back to it. */
  origin: string;
  /** Admin-only: pinned orders sort to the top of the admin list. */
  pinned: boolean;
  /** Admin-only: raised when an order needs attention (never shown to the rider). */
  flag: OrderFlag | null;
  createdAt: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

/** Validates an admin's correction to an order's delivery details. */
export function parseShipToInput(
  body: unknown,
  validStates: readonly string[],
): { ok: true; shipTo: OrderShipTo } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const shipTo: OrderShipTo = {
    name: text(b.name),
    phone: text(b.phone).replace(/\D/g, "").slice(-10),
    email: text(b.email),
    address: text(b.address),
    city: text(b.city),
    state: text(b.state),
    pincode: text(b.pincode),
  };

  if (!shipTo.name) return { ok: false, error: "Name is required" };
  if (!shipTo.address) return { ok: false, error: "Address is required" };
  if (!shipTo.city) return { ok: false, error: "City is required" };
  if (!validStates.includes(shipTo.state)) return { ok: false, error: "Choose a valid state" };
  if (!PINCODE_PATTERN.test(shipTo.pincode)) return { ok: false, error: "Pincode must be 6 digits" };
  if (shipTo.phone && shipTo.phone.length !== 10) return { ok: false, error: "Phone must be a 10-digit number" };
  if (shipTo.email && !EMAIL_PATTERN.test(shipTo.email)) return { ok: false, error: "Email isn't valid" };
  if (shipTo.name.length > 100 || shipTo.address.length > 500 || shipTo.city.length > 80) {
    return { ok: false, error: "A field is too long" };
  }
  return { ok: true, shipTo };
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Payment pending",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** Delivery details a guest fills in — stricter than an admin's edit: they have
 * no account to fall back on, so phone and email are both required. */
export function parseGuestDetails(
  body: unknown,
  validStates: readonly string[],
): { ok: true; shipTo: OrderShipTo } | { ok: false; error: string } {
  const parsed = parseShipToInput(body, validStates);
  if (!parsed.ok) return parsed;
  if (parsed.shipTo.phone.length !== 10) return { ok: false, error: "Enter your 10-digit phone number" };
  if (!parsed.shipTo.email) return { ok: false, error: "Enter your email address" };
  return parsed;
}
