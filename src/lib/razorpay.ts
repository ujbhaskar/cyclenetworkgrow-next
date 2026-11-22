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

// ---- Payment Links (shop checkout) ----------------------------------------
// Hosted Razorpay payment page per order: we create a link with the order id
// as its reference_id, send the rider there, and Razorpay redirects back to
// callback_url with a signed query string.

export type RazorpayPaymentLink = {
  id: string;
  shortUrl: string;
  status: string; // created | partially_paid | expired | cancelled | paid
  referenceId: string | null;
  /** Latest captured/authorized payment on the link, if any. */
  paymentId: string | null;
};

type RawPaymentLink = {
  id: string;
  short_url?: string;
  status?: string;
  reference_id?: string;
  payments?: Array<{ payment_id?: string; status?: string }> | null;
};

function toPaymentLink(raw: RawPaymentLink): RazorpayPaymentLink {
  const payments = raw.payments ?? [];
  const paid = payments.find((p) => p.status === "captured") ?? payments[0];
  return {
    id: raw.id,
    shortUrl: raw.short_url ?? "",
    status: raw.status ?? "",
    referenceId: raw.reference_id ?? null,
    paymentId: paid?.payment_id ?? null,
  };
}

export async function createRazorpayPaymentLink(input: {
  amountPaise: number;
  referenceId: string;
  description: string;
  callbackUrl: string;
  /** Unix seconds; Razorpay stops accepting payment on the link after this (its minimum is 15 min out). */
  expireBy: number;
  customer: { name?: string; contact?: string; email?: string };
  notes: Record<string, string>;
}): Promise<RazorpayPaymentLink> {
  const res = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
    method: "POST",
    headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: input.referenceId,
      description: input.description.slice(0, 2000),
      customer: input.customer,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
      callback_url: input.callbackUrl,
      callback_method: "get",
      expire_by: input.expireBy,
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay payment link creation failed: ${res.status} ${await res.text()}`);
  }
  return toPaymentLink((await res.json()) as RawPaymentLink);
}

export async function fetchRazorpayPaymentLink(id: string): Promise<RazorpayPaymentLink> {
  const res = await fetch(`${RAZORPAY_API_BASE}/payment_links/${encodeURIComponent(id)}`, {
    headers: { Authorization: razorpayAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Razorpay payment link fetch failed: ${res.status} ${await res.text()}`);
  }
  return toPaymentLink((await res.json()) as RawPaymentLink);
}

/** Payment method ("upi", "card", ...) and capture time, for the receipt
 * shown on the rider's order page. Best-effort: null if Razorpay can't be read. */
export async function fetchRazorpayPaymentDetails(
  paymentId: string,
): Promise<{ method: string | null; paidAt: string | null } | null> {
  try {
    const res = await fetch(`${RAZORPAY_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: razorpayAuthHeader() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const p: { method?: string; created_at?: number } = await res.json();
    return {
      method: p.method ?? null,
      paidAt: typeof p.created_at === "number" ? new Date(p.created_at * 1000).toISOString() : null,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the signed query string Razorpay appends when it redirects the
 * rider back to callback_url: HMAC-SHA256, keyed with the API key *secret*,
 * of `payment_link_id|payment_link_reference_id|payment_link_status|payment_id`.
 */
export function verifyPaymentLinkCallback(params: {
  paymentLinkId: string;
  referenceId: string;
  status: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", requireEnv("RAZORPAY_KEY_SECRET"))
    .update(`${params.paymentLinkId}|${params.referenceId}|${params.status}|${params.paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(params.signature, "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/** Stops a payment link from being paid. Returns false if Razorpay refused —
 * typically because it was already paid or is already closed. */
export async function cancelRazorpayPaymentLink(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${RAZORPAY_API_BASE}/payment_links/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { Authorization: razorpayAuthHeader() },
    });
    return res.ok;
  } catch (err) {
    console.error("[razorpay] couldn't cancel payment link:", err);
    return false;
  }
}
