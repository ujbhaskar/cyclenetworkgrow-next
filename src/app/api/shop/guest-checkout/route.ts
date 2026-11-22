import { randomBytes } from "node:crypto";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import { paymentDeadline, parseGuestDetails, type OrderItem } from "@/lib/models/order";
import { canAccessPath } from "@/lib/nav-links";
import { clientIp, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createRazorpayPaymentLink } from "@/lib/razorpay";
import { parseCartLines, resolveLines } from "@/lib/shop-cart";
import { attachPaymentLink, createPendingOrder } from "@/lib/shop-orders";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/shop/guest-checkout:
 *   post:
 *     summary: Pay for a cart without an account
 *     description: >
 *       No login needed. Takes the cart lines and the buyer's details (name, phone, email,
 *       address, city, state, pincode). Re-checks every line against the catalog, recomputes
 *       prices, creates a guest order, and returns a Razorpay payment page URL (valid 15 minutes).
 *       After paying, Razorpay returns the buyer to a private order page. Rate-limited per IP.
 *     tags:
 *       - Shop
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lines, details]
 *             properties:
 *               lines:
 *                 type: array
 *                 items:
 *                   type: object
 *               details:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   phone: { type: string }
 *                   email: { type: string }
 *                   address: { type: string }
 *                   city: { type: string }
 *                   state: { type: string }
 *                   pincode: { type: string }
 *     responses:
 *       200:
 *         description: "{ url: string }"
 *       400:
 *         description: Invalid details, empty cart, or an item that can't be bought
 *       404:
 *         description: Shop not available
 *       429:
 *         description: Too many attempts — 6 per 10 minutes per IP, and 60 per 10 minutes overall
 */
export async function POST(request: Request) {
  if (!(await canAccessPath("/shop"))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  // Honeypot: a hidden form field no person fills in. Pretend it worked so the bot moves on.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return Response.json({ url: "/shop" });
  }

  // Each call can create an order and a live payment link, and there's no account to blame.
  const limit = await checkRateLimit(`guest-checkout:${clientIp(request)}`, 6, 600);
  if (!limit.ok) return tooManyRequests(limit);
  // The per-IP key rests on a forwarded header a determined attacker could vary,
  // so also cap guest checkouts overall — far above real shop traffic.
  const overall = await checkRateLimit("guest-checkout:all", 60, 600);
  if (!overall.ok) return tooManyRequests(overall);

  const details = parseGuestDetails(body?.details, INDIAN_STATES_AND_UTS);
  if (!details.ok) {
    return Response.json({ error: details.error }, { status: 400 });
  }

  const cart = await resolveLines(parseCartLines(body?.lines));
  if (cart.lines.length === 0) {
    return Response.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (cart.hasProblems) {
    return Response.json({ error: "Some items in your cart can't be bought right now. Please fix them first." }, { status: 400 });
  }
  if (cart.subtotal < 1) {
    return Response.json({ error: "This order can't be paid online." }, { status: 400 });
  }

  const items: OrderItem[] = cart.lines.map((line) => ({
    productId: line.productId,
    productTitle: line.title,
    productImage: line.image,
    color: line.color,
    size: line.size,
    sleeve: line.sleeve,
    unitPrice: line.unitPrice,
    qty: line.qty,
  }));
  const amount = cart.subtotal;
  const shipTo = details.shipTo;
  const origin = getSiteOrigin(request);

  // The secret in the buyer's order-page link — they have no login to prove who they are.
  const guestToken = randomBytes(24).toString("base64url");
  const order = await createPendingOrder({ uid: null, guestToken, items, amount, shipTo, origin });

  const summary = items.map((i) => `${i.qty} × ${i.productTitle}`).join(", ");
  try {
    const link = await createRazorpayPaymentLink({
      amountPaise: amount * 100,
      referenceId: order.id,
      description: `${summary} — order ${order.orderNumber}`,
      callbackUrl: `${origin}/api/shop/payment-callback`,
      expireBy: Math.ceil(paymentDeadline({ createdAt: new Date().toISOString() }) / 1000),
      customer: { name: shipTo.name, contact: `+91${shipTo.phone}`, email: shipTo.email },
      notes: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        guest: "yes",
        buyer_name: shipTo.name.slice(0, 250),
        buyer_phone: shipTo.phone,
        items: summary.slice(0, 250),
      },
    });
    await attachPaymentLink(order.id, { id: link.id, url: link.shortUrl });
    return Response.json({ url: link.shortUrl });
  } catch (err) {
    console.error("[shop guest-checkout] couldn't create payment link:", err);
    return Response.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
