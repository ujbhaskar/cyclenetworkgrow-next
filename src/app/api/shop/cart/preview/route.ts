import { canAccessPath } from "@/lib/nav-links";
import { clientIp, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseCartLines, resolveLines } from "@/lib/shop-cart";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/shop/cart/preview:
 *   post:
 *     summary: Price a cart held in the browser (guest checkout)
 *     description: >
 *       No login needed. Takes cart lines (productId, color, size, sleeve, qty) and returns them
 *       joined with the live catalog — current titles, images, prices and whether each line can be
 *       bought right now. Nothing is stored. Rate-limited per IP.
 *     tags:
 *       - Shop
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lines:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: The resolved cart
 *       404:
 *         description: Shop not available
 *       429:
 *         description: Too many requests
 */
export async function POST(request: Request) {
  if (!(await canAccessPath("/shop"))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const limit = await checkRateLimit(`guest-preview:${clientIp(request)}`, 120, 60);
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  return Response.json(await resolveLines(parseCartLines(body?.lines)));
}
