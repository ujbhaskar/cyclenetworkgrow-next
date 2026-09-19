import "server-only";
import crypto from "crypto";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * Verifies a Razorpay webhook's `x-razorpay-signature` header per their
 * documented scheme: HMAC-SHA256 of the *raw* request body (not a
 * re-serialized copy — JSON.stringify can reorder/respace bytes and break
 * the signature), hex-encoded, keyed with the webhook secret configured in
 * the Razorpay dashboard. `rawBody` must be the exact bytes/text Razorpay
 * sent, read before any JSON.parse.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = crypto.createHmac("sha256", requireEnv("RAZORPAY_WEBHOOK_SECRET")).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signatureHeader, "hex");
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
