import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME = "session";

// Firebase Admin SDK caps session cookies at 14 days.
const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS });
}

/**
 * Signature + expiry check only, no revocation lookup — cheap enough to run
 * on every matched request. Used by proxy.ts for the optimistic gate.
 * Never treat this as the authorization decision; see verifySessionCookieStrict.
 */
export async function verifySessionCookieOptimistic(sessionCookie: string) {
  return adminAuth.verifySessionCookie(sessionCookie, false);
}

/**
 * Full check including revocation. This is the authoritative verification —
 * always use this (via the DAL's verifySession()) before touching privileged data.
 */
export async function verifySessionCookieStrict(sessionCookie: string) {
  return adminAuth.verifySessionCookie(sessionCookie, true);
}
