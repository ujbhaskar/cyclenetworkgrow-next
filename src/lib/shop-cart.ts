import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { cartLineKey, clampQty, type CartLine, type ResolvedCart, type ResolvedCartLine } from "@/lib/models/cart";
import { MAX_QTY_PER_LINE, isSoldOut, unitPrice, type Product } from "@/lib/models/product";
import { getPublishedProduct } from "@/lib/products";

// Cart per signed-in rider, server-side so it follows them across devices.
// Own collection name — see the note in src/lib/shop-orders.ts.
const COLLECTION = "shopCarts";

export const MAX_CART_LINES = 30;

/** Defensive parse of cart lines from storage or from a request body. */
export function parseCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_CART_LINES).flatMap((item): CartLine[] => {
    const o = (item ?? {}) as Record<string, unknown>;
    if (typeof o.productId !== "string" || !o.productId) return [];
    const opt = (v: unknown) => (typeof v === "string" && v ? v : null);
    return [{ productId: o.productId, color: opt(o.color), size: opt(o.size), sleeve: opt(o.sleeve), qty: clampQty(o.qty) }];
  });
}

export async function getCartLines(uid: string): Promise<CartLine[]> {
  const doc = await adminDb.collection(COLLECTION).doc(uid).get();
  return parseCartLines(doc.data()?.items);
}

async function saveCartLines(uid: string, items: CartLine[]): Promise<void> {
  await adminDb.collection(COLLECTION).doc(uid).set({ items, updatedAt: new Date().toISOString() });
}

export async function getCartCount(uid: string): Promise<number> {
  return (await getCartLines(uid)).reduce((sum, line) => sum + line.qty, 0);
}

/** Checks a rider's picks against the product: every option the product
 * offers must be chosen, and a product that offers none must get none. */
export function validateSelection(
  product: Product,
  body: { color?: unknown; size?: unknown; sleeve?: unknown },
): { ok: true; color: string | null; size: string | null; sleeve: string | null } | { ok: false; error: string } {
  const pick = (label: string, offered: string[], picked: unknown) => {
    if (offered.length === 0) return { value: null as string | null };
    if (typeof picked !== "string" || !offered.includes(picked)) return { error: `Please choose a ${label}.` };
    return { value: picked as string | null };
  };
  const color = pick("color", product.colors, body.color);
  const size = pick("size", product.sizes, body.size);
  const sleeve = pick("sleeve", product.sleeves.map((s) => s.name), body.sleeve);
  const error = ("error" in color && color.error) || ("error" in size && size.error) || ("error" in sleeve && sleeve.error);
  if (error) return { ok: false, error };
  return { ok: true, color: color.value ?? null, size: size.value ?? null, sleeve: sleeve.value ?? null };
}

/** Adds to the cart, merging with an identical line. Refuses a combination the admin marked out of stock. */
export async function addToCart(
  uid: string,
  product: Product,
  choice: { color: string | null; size: string | null; sleeve: string | null },
  qty: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isSoldOut(product, choice)) {
    return { ok: false, error: "Sorry, that option is out of stock." };
  }

  const lines = await getCartLines(uid);
  const key = cartLineKey({ productId: product.id, ...choice });
  const existing = lines.find((l) => cartLineKey(l) === key);

  const next = existing
    ? lines.map((l) => (cartLineKey(l) === key ? { ...l, qty: clampQty(l.qty + qty) } : l))
    : [...lines, { productId: product.id, ...choice, qty: clampQty(qty) }];
  await saveCartLines(uid, next);
  return { ok: true };
}

export async function setLineQty(uid: string, key: string, qty: number): Promise<void> {
  const lines = await getCartLines(uid);
  await saveCartLines(uid, qty <= 0 ? lines.filter((l) => cartLineKey(l) !== key) : lines.map((l) => (cartLineKey(l) === key ? { ...l, qty: clampQty(qty) } : l)));
}

/** After a paid order: take exactly what was bought out of the cart, leaving anything added since. */
export async function removeOrderedFromCart(
  uid: string,
  items: { productId: string; color: string | null; size: string | null; sleeve: string | null; qty: number }[],
): Promise<void> {
  const lines = await getCartLines(uid);
  if (lines.length === 0) return;
  const bought = new Map<string, number>();
  items.forEach((item) => bought.set(cartLineKey(item), (bought.get(cartLineKey(item)) ?? 0) + item.qty));
  const next = lines
    .map((l) => ({ ...l, qty: l.qty - (bought.get(cartLineKey(l)) ?? 0) }))
    .filter((l) => l.qty > 0);
  await saveCartLines(uid, next);
}

/** The cart joined with live product data: current prices, and which lines
 * can't be bought right now (product gone, option removed, marked out of stock). */
export async function resolveCart(uid: string): Promise<ResolvedCart> {
  return resolveLines(await getCartLines(uid));
}

/** Same as resolveCart but for lines the caller already has — a guest's cart,
 * which lives in their browser and is untrusted until resolved here. */
export async function resolveLines(lines: CartLine[]): Promise<ResolvedCart> {
  const products = new Map<string, Product | null>();
  await Promise.all(
    [...new Set(lines.map((l) => l.productId))].map(async (id) => products.set(id, await getPublishedProduct(id))),
  );

  const resolved: ResolvedCartLine[] = lines.map((line) => {
    const product = products.get(line.productId) ?? null;
    const base = { ...line, key: cartLineKey(line) };
    if (!product) {
      return { ...base, title: "Unavailable product", image: null, unitPrice: 0, lineTotal: 0, maxQty: 1, available: false, issue: "This product is no longer available." };
    }
    const check = validateSelection(product, line);
    const price = unitPrice(product, line.sleeve);
    const out = {
      ...base,
      title: product.title,
      image: product.images[0] ?? null,
      unitPrice: price,
      lineTotal: price * line.qty,
      maxQty: MAX_QTY_PER_LINE,
    };
    if (!check.ok) return { ...out, available: false, issue: "One of the options you chose is no longer offered." };
    if (isSoldOut(product, line)) return { ...out, available: false, issue: "Out of stock." };
    return { ...out, available: true, issue: null };
  });

  return {
    lines: resolved,
    subtotal: resolved.filter((l) => l.available).reduce((sum, l) => sum + l.lineTotal, 0),
    itemCount: resolved.reduce((sum, l) => sum + l.qty, 0),
    hasProblems: resolved.some((l) => !l.available),
  };
}
