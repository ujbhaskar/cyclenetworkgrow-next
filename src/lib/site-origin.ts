import "server-only";

/**
 * This site's public origin, for URLs handed to third parties (e.g. the
 * Razorpay callback). SITE_URL wins when set; otherwise it's derived from the
 * request, preferring the forwarded host since App Hosting's Cloud Run sits
 * behind a proxy and request.url may carry an internal host.
 */
export function getSiteOrigin(request: Request): string {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/, "");
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
