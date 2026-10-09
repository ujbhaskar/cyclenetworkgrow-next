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
  amount: number;
  created_at: number;
  notes?: Record<string, unknown>;
};

export type RazorpayCapturedPayment = {
  id: string;
  contact: string | null;
  email: string | null;
  amount: number;
  createdAt: string;
  notes: {
    full_name?: string;
    gender?: string;
    city?: string;
    state?: string;
    address?: string;
    pincode?: string;
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
        amount: p.amount,
        createdAt: new Date(p.created_at * 1000).toISOString(),
        notes: {
          full_name: typeof p.notes?.full_name === "string" ? (p.notes.full_name as string) : undefined,
          gender: typeof p.notes?.gender === "string" ? (p.notes.gender as string) : undefined,
          city: typeof p.notes?.city === "string" ? (p.notes.city as string) : undefined,
          state: typeof p.notes?.state === "string" ? (p.notes.state as string) : undefined,
          address: typeof p.notes?.address === "string" ? (p.notes.address as string) : undefined,
          pincode: typeof p.notes?.pincode === "string" ? (p.notes.pincode as string) : undefined,
        },
      });
    }

    if (items.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return results;
}

type RawRazorpayPaymentPage = {
  id: string;
  short_url?: string;
  title?: string;
  status?: string;
  payment_page_items?: Array<{ item?: { amount?: number } }>;
};

export type RazorpayPaymentPage = {
  id: string;
  shortUrl: string;
  title: string;
  status: string;
  /** The page's configured price, in paise — null if it couldn't be read. */
  amount: number | null;
};

function normalizeShortUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

async function fetchAllRazorpayPaymentPages(): Promise<RazorpayPaymentPage[]> {
  const authHeader = razorpayAuthHeader();
  const results: RazorpayPaymentPage[] = [];
  const PAGE_SIZE = 100;
  let skip = 0;

  for (;;) {
    const url = `${RAZORPAY_API_BASE}/payment_pages?count=${PAGE_SIZE}&skip=${skip}`;
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (!res.ok) {
      throw new Error(`Razorpay payment pages fetch failed: ${res.status} ${await res.text()}`);
    }
    const body: { items?: RawRazorpayPaymentPage[] } = await res.json();
    const items = body.items ?? [];

    for (const pp of items) {
      results.push({
        id: pp.id,
        shortUrl: pp.short_url ?? "",
        title: pp.title ?? "",
        status: pp.status ?? "",
        amount: pp.payment_page_items?.[0]?.item?.amount ?? null,
      });
    }

    if (items.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return results;
}

/**
 * Finds the Payment Page matching an event's own `payment_link` field (the
 * admin-maintained URL already used for the public "Join Now" button) —
 * lets registration sync scope to exactly this event's fixed price instead
 * of guessing by date range alone. Razorpay's API has no direct "payments
 * for this page" endpoint (confirmed: neither the Payment nor Order entity
 * references its originating page), so the page's own configured amount is
 * the practical proxy. Returns null if no page's short_url matches —
 * callers should fall back to date-range-only scoping rather than fail.
 */
export async function fetchRazorpayPaymentPageByShortUrl(shortUrl: string): Promise<RazorpayPaymentPage | null> {
  const target = normalizeShortUrl(shortUrl);
  const pages = await fetchAllRazorpayPaymentPages();
  return pages.find((p) => normalizeShortUrl(p.shortUrl) === target) ?? null;
}
