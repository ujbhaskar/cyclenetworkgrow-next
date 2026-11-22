import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { createProduct, listAllProducts } from "@/lib/products";
import { parseProductInput } from "@/lib/models/product";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: List all shop products (published and unpublished)
 *     description: Requires admin role.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ products: Product[] }"
 */
export async function GET() {
  await requireRole("admin");
  return Response.json({ products: await listAllProducts() });
}

/**
 * @swagger
 * /api/admin/products:
 *   post:
 *     summary: Create a shop product
 *     description: Requires admin role. `images` are already-uploaded public URLs (see /api/admin/products/images); the first is the cover image.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, price]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               images: { type: array, items: { type: string } }
 *               price: { type: number, description: Whole rupees }
 *               colors: { type: array, items: { type: string } }
 *               sizes: { type: array, items: { type: string } }
 *               published: { type: boolean }
 *     responses:
 *       200:
 *         description: "{ id: string }"
 *       400:
 *         description: Invalid fields
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const parsed = parseProductInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = await createProduct(parsed.input);
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_created_product",
    targetId: id,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ id });
}
