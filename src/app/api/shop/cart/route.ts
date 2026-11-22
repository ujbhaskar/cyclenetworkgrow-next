import { verifySession } from "@/lib/auth/dal";
import { clampQty } from "@/lib/models/cart";
import { canAccessPath } from "@/lib/nav-links";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getPublishedProduct } from "@/lib/products";
import { addToCart, getCartCount, setLineQty, validateSelection } from "@/lib/shop-cart";

export const dynamic = "force-dynamic";

// Cart changes: generous for real use (qty steppers click fast), tight enough to stop a script.
const CART_LIMIT = 60;
const CART_WINDOW_SECONDS = 60;

async function limited(uid: string): Promise<Response | null> {
  const result = await checkRateLimit(`cart:${uid}`, CART_LIMIT, CART_WINDOW_SECONDS);
  return result.ok ? null : tooManyRequests(result);
}

// A locked (admin-only) shop has no cart for anyone else either.
async function shopClosedFor(): Promise<Response | null> {
  return (await canAccessPath("/shop")) ? null : Response.json({ error: "Not found" }, { status: 404 });
}

/**
 * @swagger
 * /api/shop/cart:
 *   post:
 *     summary: Add a product to the signed-in rider's cart
 *     description: Validates color/size/sleeve against the product and refuses a combination marked out of stock. An identical line (same product and options) just has its quantity increased.
 *     tags:
 *       - Shop
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string }
 *               color: { type: string }
 *               size: { type: string }
 *               sleeve: { type: string }
 *               qty: { type: integer, minimum: 1, maximum: 10 }
 *     responses:
 *       200:
 *         description: "{ itemCount: number }"
 *       400:
 *         description: Invalid selection, or marked out of stock
 *       404:
 *         description: Product not found or not published
 *       429:
 *         description: Too many cart changes — 60 per minute per user
 */
export async function POST(request: Request) {
  const session = await verifySession();
  const closed = (await shopClosedFor()) ?? (await limited(session.uid));
  if (closed) return closed;

  const body = await request.json().catch(() => ({}));
  const product = typeof body.productId === "string" ? await getPublishedProduct(body.productId) : null;
  if (!product) {
    return Response.json({ error: "This product isn't available." }, { status: 404 });
  }

  const choice = validateSelection(product, body);
  if (!choice.ok) {
    return Response.json({ error: choice.error }, { status: 400 });
  }

  const result = await addToCart(session.uid, product, choice, clampQty(body.qty));
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ itemCount: await getCartCount(session.uid) });
}

/**
 * @swagger
 * /api/shop/cart:
 *   patch:
 *     summary: Change the quantity of one cart line
 *     description: "`key` is the line's key as returned in the cart page data. A quantity of 0 removes the line. The new quantity is capped at 10 per line (availability is re-checked at checkout)."
 *     tags:
 *       - Shop
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, qty]
 *             properties:
 *               key: { type: string }
 *               qty: { type: integer, minimum: 0, maximum: 10 }
 *     responses:
 *       200:
 *         description: "{ itemCount: number }"
 */
export async function PATCH(request: Request) {
  const session = await verifySession();
  const closed = (await shopClosedFor()) ?? (await limited(session.uid));
  if (closed) return closed;

  const body = await request.json().catch(() => ({}));
  if (typeof body.key !== "string" || !Number.isFinite(Number(body.qty))) {
    return Response.json({ error: "key and qty are required" }, { status: 400 });
  }
  await setLineQty(session.uid, body.key, Math.floor(Number(body.qty)));
  return Response.json({ itemCount: await getCartCount(session.uid) });
}

/**
 * @swagger
 * /api/shop/cart:
 *   delete:
 *     summary: Remove one line from the cart
 *     tags:
 *       - Shop
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key: { type: string }
 *     responses:
 *       200:
 *         description: "{ itemCount: number }"
 */
export async function DELETE(request: Request) {
  const session = await verifySession();
  const blocked = await limited(session.uid);
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));
  if (typeof body.key !== "string") {
    return Response.json({ error: "key is required" }, { status: 400 });
  }
  await setLineQty(session.uid, body.key, 0);
  return Response.json({ itemCount: await getCartCount(session.uid) });
}
