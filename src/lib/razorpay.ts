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

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function razorpayAuthHeader(): string {
  const keyId = requireEnv("RAZORPAY_KEY_ID");
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

type RawRazorpayPayment = {
  id: string;
  status: string;
  contact?: string;
  email?: string;
  created_at: number;
  notes?: Record<string, unknown>;
};

export type RazorpayCapturedPayment = {
  id: string;
  contact: string | null;
  email: string | null;
  createdAt: string;
  notes: {
    full_name?: string;
    gender?: string;
    city?: string;
    state?: string;
  };
};

/**
 * Every *captured* (successfully paid) payment in a date range — paginated
 * through Razorpay's Payments API (100 per page, via `skip`). This is what
 * lets the registration sync read directly from Razorpay instead of a
 * manually-exported Google Sheet; see src/lib/razorpay-registrations.ts.
 * `fromUnix`/`toUnix` are Unix seconds (Razorpay's own unit, not ms).
 */
export async function fetchCapturedRazorpayPayments(fromUnix: number, toUnix: number): Promise<RazorpayCapturedPayment[]> {
  const authHeader = razorpayAuthHeader();
  const results: RazorpayCapturedPayment[] = [];
  const PAGE_SIZE = 100;
  let skip = 0;

  for (;;) {
    const url = `${RAZORPAY_API_BASE}/payments?from=${fromUnix}&to=${toUnix}&count=${PAGE_SIZE}&skip=${skip}`;
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (!res.ok) {
      throw new Error(`Razorpay payments fetch failed: ${res.status} ${await res.text()}`);
    }
    const body: { items?: RawRazorpayPayment[] } = await res.json();
    const items = body.items ?? [];

    for (const p of items) {
      if (p.status !== "captured") continue;
      results.push({
        id: p.id,
        contact: typeof p.contact === "string" ? p.contact : null,
        email: typeof p.email === "string" ? p.email : null,
        createdAt: new Date(p.created_at * 1000).toISOString(),
        notes: {
          full_name: typeof p.notes?.full_name === "string" ? (p.notes.full_name as string) : undefined,
          gender: typeof p.notes?.gender === "string" ? (p.notes.gender as string) : undefined,
          city: typeof p.notes?.city === "string" ? (p.notes.city as string) : undefined,
          state: typeof p.notes?.state === "string" ? (p.notes.state as string) : undefined,
        },
      });
    }

    if (items.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return results;
}
