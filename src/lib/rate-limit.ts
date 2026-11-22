import "server-only";
import { adminDb } from "@/lib/firebase/admin";

// Fixed-window counter in Firestore — shared by every server instance (an
// in-memory counter would let each Cloud Run instance count separately, so
// the real limit would be limit × instances).
const COLLECTION = "shopRateLimits";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Allows at most `limit` calls per `windowSeconds` for `key` (e.g.
 * `cart:<uid>`). Counts the call being checked. Fails OPEN on a Firestore
 * error — better to let a shopper through than to block the whole shop when
 * the limiter itself has a hiccup (the error is logged).
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const ref = adminDb.collection(COLLECTION).doc(encodeURIComponent(key));
  const now = Date.now();

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as { count?: number; resetAt?: number } | undefined;

      if (!data || typeof data.resetAt !== "number" || data.resetAt <= now) {
        tx.set(ref, { count: 1, resetAt: now + windowSeconds * 1000, expireAt: new Date(now + windowSeconds * 2000) });
        return { ok: true } as const;
      }
      if ((data.count ?? 0) >= limit) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((data.resetAt - now) / 1000)) } as const;
      }
      tx.update(ref, { count: (data.count ?? 0) + 1 });
      return { ok: true } as const;
    });
  } catch (err) {
    console.error("[rate-limit] check failed, allowing the request:", err);
    return { ok: true };
  }
}

export function tooManyRequests(result: Extract<RateLimitResult, { ok: false }>): Response {
  return Response.json(
    { error: "You're doing that too quickly. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

/** Best-effort caller address for rate-limiting anonymous endpoints (behind
 * App Hosting's proxy the client is the first entry of X-Forwarded-For). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
}
