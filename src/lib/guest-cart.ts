// A guest's cart lives in their own browser (localStorage) — they have no
// account to keep it on. Client-side only; nothing here is trusted by the
// server, which re-prices and re-validates every line at checkout.

import { cartLineKey, clampQty, type CartLine } from "@/lib/models/cart";

const KEY = "cng-guest-cart-v1";
export const GUEST_CART_EVENT = "guest-cart-changed";
const MAX_LINES = 30;

function parse(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const opt = (v: unknown) => (typeof v === "string" && v ? v : null);
    return data.slice(0, MAX_LINES).flatMap((item): CartLine[] => {
      const o = (item ?? {}) as Record<string, unknown>;
      if (typeof o.productId !== "string" || !o.productId) return [];
      return [{ productId: o.productId, color: opt(o.color), size: opt(o.size), sleeve: opt(o.sleeve), qty: clampQty(o.qty) }];
    });
  } catch {
    return [];
  }
}

export function readGuestCart(): CartLine[] {
  try {
    return parse(window.localStorage.getItem(KEY));
  } catch {
    return []; // storage blocked (private mode etc.) — behave as an empty cart
  }
}

function write(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable — nothing to persist */
  }
  window.dispatchEvent(new Event(GUEST_CART_EVENT));
}

export function guestCartCount(): number {
  return readGuestCart().reduce((sum, line) => sum + line.qty, 0);
}

/** Adds a line, merging with an identical one (same product and options). */
export function addToGuestCart(line: CartLine): void {
  const lines = readGuestCart();
  const key = cartLineKey(line);
  const existing = lines.find((l) => cartLineKey(l) === key);
  write(
    existing
      ? lines.map((l) => (cartLineKey(l) === key ? { ...l, qty: clampQty(l.qty + line.qty) } : l))
      : [...lines, { ...line, qty: clampQty(line.qty) }].slice(0, MAX_LINES),
  );
}

/** A quantity of 0 or less removes the line. */
export function setGuestLineQty(key: string, qty: number): void {
  const lines = readGuestCart();
  write(qty <= 0 ? lines.filter((l) => cartLineKey(l) !== key) : lines.map((l) => (cartLineKey(l) === key ? { ...l, qty: clampQty(qty) } : l)));
}

export function clearGuestCart(): void {
  write([]);
}
