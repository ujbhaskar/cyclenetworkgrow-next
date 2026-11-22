import { verifySession } from "@/lib/auth/dal";
import { cleanPhone } from "@/lib/registration-normalize";
import { getUserProfile } from "@/lib/user-profile";
import { canAccessPath } from "@/lib/nav-links";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { OrderItem } from "@/lib/models/order";
import { resolveCart } from "@/lib/shop-cart";
import { attachPaymentLink, createPendingOrder, findReusableOrder, syncOrderPayment } from "@/lib/shop-orders";
import { createRazorpayPaymentLink, fetchRazorpayPaymentLink } from "@/lib/razorpay";
import { getSiteOrigin } from "@/lib/site-origin";
import { isSyntheticEmail } from "@/lib/auth/phone";
import { paymentDeadline } from "@/lib/models/order";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/shop/checkout:
 *   post:
 *     summary: Pay for the cart
 *     description: >
 *       Requires a signed-in user. Takes no body — it works from the rider's server-side cart.
 *       Re-checks every line (still published, options still offered, not marked out of stock), recomputes
 *       prices from the catalog, snapshots the rider's profile address into a new order, creates a
 *       Razorpay Payment Link for the total, and returns that hosted payment page's URL. If the
 *       rider already has an identical unpaid order whose payment page is still open (they pressed
 *       Back), that one is reused. Razorpay sends the rider back to /api/shop/payment-callback.
 *       The payment page is only valid for 15 minutes; after that the order expires and the
 *       rider has to check out again.
 *     tags:
 *       - Shop
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ url: string, orderId: string }"
 *       400:
 *         description: Empty cart, an item that can't be bought, or the profile has no delivery address
 *       404:
 *         description: Shop not available
 *       429:
 *         description: Too many attempts — 8 per 10 minutes per user
 */
export async function POST(request: Request) {
  const session = await verifySession();
  if (!(await canAccessPath("/shop"))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Each call can create an order and a live Razorpay payment link, so this is
  // much tighter than the cart limit: 8 attempts per 10 minutes per rider.
  const limit = await checkRateLimit(`checkout:${session.uid}`, 8, 600);
  if (!limit.ok) return tooManyRequests(limit);

  const cart = await resolveCart(session.uid);
  if (cart.lines.length === 0) {
    return Response.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (cart.hasProblems) {
    return Response.json({ error: "Some items in your cart can't be bought right now. Please fix them first." }, { status: 400 });
  }
  if (cart.subtotal < 1) {
    return Response.json({ error: "This order can't be paid online." }, { status: 400 });
  }

  // Delivery details come from the rider's profile, never from the request.
  const profile = await getUserProfile(session.uid);
  if (!profile?.address || !profile.city || !profile.state || !profile.pincode) {
    return Response.json(
      { error: "Please add your full delivery address (address, city, state, pincode) to your profile first.", code: "address_missing" },
      { status: 400 },
    );
  }
  const phone = profile.phone ? cleanPhone(profile.phone) : "";
  const shipTo = {
    name: profile.displayName,
    phone,
    // Phone-only signups carry a made-up address — don't treat it as real.
    email: profile.email && !isSyntheticEmail(profile.email) ? profile.email : "",
    address: profile.address,
    city: profile.city,
    state: profile.state,
    pincode: profile.pincode,
  };

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

  // Back-button retry: reuse the earlier unpaid order if its payment page is still open.
  const earlier = await findReusableOrder(session.uid, items, amount);
  if (earlier?.paymentLinkId && earlier.paymentLinkUrl) {
    try {
      const link = await fetchRazorpayPaymentLink(earlier.paymentLinkId);
      if (link.status === "paid") {
        // They did pay after all (e.g. closed the tab before the redirect back).
        await syncOrderPayment(earlier);
        return Response.json({ url: `${getSiteOrigin(request)}/my-orders/${earlier.id}`, orderId: earlier.id });
      }
      if (link.status === "created") {
        return Response.json({ url: earlier.paymentLinkUrl, orderId: earlier.id });
      }
      // expired / cancelled / partially paid — fall through and start a fresh order
    } catch (err) {
      console.error("[shop checkout] couldn't check the earlier payment link:", err);
    }
  }

  const order = await createPendingOrder({ uid: session.uid, items, amount, shipTo });

  const summary = items.map((i) => `${i.qty} × ${i.productTitle}`).join(", ");
  try {
    const link = await createRazorpayPaymentLink({
      amountPaise: amount * 100,
      referenceId: order.id,
      description: `${summary} — order ${order.orderNumber}`,
      callbackUrl: `${getSiteOrigin(request)}/api/shop/payment-callback`,
      // The payment page itself stops working after the window, not just our bookkeeping.
      expireBy: Math.ceil(paymentDeadline({ createdAt: new Date().toISOString() }) / 1000),
      customer: {
        name: shipTo.name,
        ...(phone.length === 10 ? { contact: `+91${phone}` } : {}),
        ...(shipTo.email ? { email: shipTo.email } : {}),
      },
      notes: { orderId: order.id, orderNumber: order.orderNumber, uid: session.uid },
    });
    await attachPaymentLink(order.id, { id: link.id, url: link.shortUrl });
    return Response.json({ url: link.shortUrl, orderId: order.id });
  } catch (err) {
    console.error("[shop checkout] couldn't create payment link:", err);
    return Response.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
