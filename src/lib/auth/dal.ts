import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionCookieStrict } from "./session";
import { ROLES, type Role } from "@/lib/models/user";

export type { Role } from "@/lib/models/user";

export type Session = {
  uid: string;
  role: Role;
};

/**
 * Reads and verifies the session cookie without redirecting — returns null
 * for a signed-out visitor. Use this for pages/layouts that render fine for
 * anonymous users but want to know who's logged in if anyone (e.g. the site
 * header showing "Log in" vs. the rider's name). For anything that actually
 * requires a signed-in user, use verifySession()/requireRole() instead.
 */
export const getOptionalSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await verifySessionCookieStrict(sessionCookie);
    const role: Role = ROLES.includes(decoded.role) ? decoded.role : "rider";
    return { uid: decoded.uid, role };
  } catch {
    return null;
  }
});

/**
 * The Data Access Layer's session check — the actual authorization boundary
 * for this app (proxy.ts only does a cheap optimistic pre-check; see
 * docs/ARCHITECTURE.md §4). Wrapped in React's cache() so it runs once per
 * request even when called from multiple components/layouts.
 *
 * Call this from every page, Server Action, and Route Handler that touches
 * privileged or per-user data — not just once in a shared layout. A layout
 * does not reliably re-run on client-side navigation between its sibling
 * routes, so a check placed only there can be skipped.
 */
export const verifySession = cache(async (): Promise<Session> => {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

export async function requireRole(role: Role): Promise<Session> {
  const session = await verifySession();
  if (session.role !== role) {
    redirect("/");
  }
  return session;
}
