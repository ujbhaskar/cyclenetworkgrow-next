import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionCookieOptimistic } from "@/lib/auth/session";

const ADMIN_PREFIX = "/admin";
const RIDER_PREFIXES = ["/profile", "/my-events", "/my-orders", "/cart"];

/**
 * Optimistic check only — cheap, no revocation lookup. The real
 * authorization boundary is the Data Access Layer (src/lib/auth/dal.ts),
 * called from every page/Server Action/Route Handler. See
 * docs/ARCHITECTURE.md §4.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isRiderRoute = RIDER_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isAdminRoute && !isRiderRoute) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Remember where they were headed so login can send them back there.
  const loginRedirect = () => {
    const url = new URL("/login", request.url);
    if (isRiderRoute) {
      url.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(url);
  };

  if (!sessionCookie) {
    return loginRedirect();
  }

  try {
    const decoded = await verifySessionCookieOptimistic(sessionCookie);
    if (isAdminRoute && decoded.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    return loginRedirect();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/my-events/:path*", "/my-orders/:path*", "/cart/:path*"],
};
