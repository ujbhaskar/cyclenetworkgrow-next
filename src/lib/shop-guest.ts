import "server-only";
import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";

// A guest has no account, so their order page is opened by a private link that
// carries a random token stored on the order. Kept in its own module (not on
// ShopOrder) so the token never travels to an admin's browser with the order list.

/** The guest's private order-page secret, or null if the order isn't a guest order. */
export async function getGuestToken(orderId: string): Promise<string | null> {
  const doc = await adminDb.collection("shopOrders").doc(orderId).get();
  const token = doc.data()?.guestToken;
  return typeof token === "string" && token ? token : null;
}

/** Constant-time check of a guest's order-page token. */
export async function guestTokenMatches(orderId: string, token: string): Promise<boolean> {
  const real = await getGuestToken(orderId);
  if (!real || !token) return false;
  const a = Buffer.from(real);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
