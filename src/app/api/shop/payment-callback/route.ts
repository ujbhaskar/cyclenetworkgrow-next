import { getGuestToken } from "@/lib/shop-guest";
import { getOrder, markOrderPaid } from "@/lib/shop-orders";
import { verifyPaymentLinkCallback } from "@/lib/razorpay";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/shop/payment-callback:
 *   get:
 *     summary: Razorpay redirects the rider here after the payment page
 *     description: >
 *       Verifies Razorpay's signature over the query string, marks the order paid if the link's
 *       status is "paid", and redirects to the buyer's order summary page (the rider's My orders page,
 *       or the private order page for a guest). An unsigned or
 *       tampered request never marks anything paid — it just lands on the order page, which
 *       checks the real status with Razorpay itself. Not meant to be called by hand.
 *     tags:
 *       - Shop
 *     responses:
 *       303:
 *         description: Redirect to /my-orders/{orderId} (or /my-orders)
 */
export async function GET(request: Request) {
  const origin = getSiteOrigin(request);
  const q = new URL(request.url).searchParams;

  const paymentId = q.get("razorpay_payment_id") ?? "";
  const linkId = q.get("razorpay_payment_link_id") ?? "";
  const orderId = q.get("razorpay_payment_link_reference_id") ?? "";
  const status = q.get("razorpay_payment_link_status") ?? "";
  const signature = q.get("razorpay_signature") ?? "";

  // A guest has no account, so they go to their private order page; a rider to My orders.
  const guestToken = orderId ? await getGuestToken(orderId) : null;
  const destination = !orderId
    ? "/my-orders"
    : guestToken
      ? `/order/${encodeURIComponent(orderId)}?t=${encodeURIComponent(guestToken)}`
      : `/my-orders/${encodeURIComponent(orderId)}`;

  if (paymentId && linkId && orderId && status === "paid" && signature) {
    let valid = false;
    try {
      valid = verifyPaymentLinkCallback({ paymentLinkId: linkId, referenceId: orderId, status, paymentId, signature });
    } catch (err) {
      console.error("[shop payment-callback] couldn't verify signature:", err);
    }

    if (valid) {
      const order = await getOrder(orderId);
      // The signature proves Razorpay sent it; also make sure it's for THIS order's link.
      if (order && order.paymentLinkId === linkId) {
        await markOrderPaid(orderId, paymentId).catch((err) =>
          console.error("[shop payment-callback] couldn't mark order paid:", err),
        );
      }
    } else {
      console.error("[shop payment-callback] signature mismatch for order", orderId);
    }
  }

  return Response.redirect(`${origin}${destination}`, 303);
}
