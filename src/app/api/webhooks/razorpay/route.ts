import { adminDb } from "@/lib/firebase/admin";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/webhooks/razorpay:
 *   post:
 *     summary: Razorpay payment event (registration sync, stage 1)
 *     description: >
 *       Verifies the x-razorpay-signature header, then just records the raw
 *       event — same "land it safely first, wire up the real sync once the
 *       payload shape is confirmed against real data" staging as the Strava
 *       webhook route. Turning a captured payment into a rider entry on the
 *       right event needs the real field names for the Payment Page's
 *       custom fields (full name/gender/city/state), which Razorpay's docs
 *       don't fully specify — check razorpayWebhookEvents for a real
 *       payment.captured event's shape before building that part.
 *     tags:
 *       - Razorpay
 *     responses:
 *       200:
 *         description: Acknowledged
 *       401:
 *         description: Signature verification failed
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    console.error("[razorpay webhook] signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // Awaited so a write failure is at least logged, but this is the only
  // work done before acking — Razorpay retries/disables a webhook that's
  // consistently slow or erroring.
  await adminDb
    .collection("razorpayWebhookEvents")
    .add({ ...event, receivedAt: new Date().toISOString() })
    .catch((err) => console.error("[razorpay webhook] failed to record event:", err));

  return Response.json({ ok: true });
}
