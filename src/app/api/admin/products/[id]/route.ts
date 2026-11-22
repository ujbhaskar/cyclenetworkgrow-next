import { requireRole } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { deleteProduct, updateProduct } from "@/lib/products";
import { parseProductInput } from "@/lib/models/product";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/products/{id}:
 *   put:
 *     summary: Replace a shop product's details
 *     description: Requires admin role. Same body as POST /api/admin/products.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid fields
 *       404:
 *         description: Product not found
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const parsed = parseProductInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  if (!(await updateProduct(id, parsed.input))) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_updated_product",
    targetId: id,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}

/**
 * @swagger
 * /api/admin/products/{id}:
 *   delete:
 *     summary: Delete a shop product
 *     description: Requires admin role. Irreversible (uploaded images stay in Storage).
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  await deleteProduct(id);
  await adminDb.collection("auditLog").add({
    actorUid: session.uid,
    action: "admin_deleted_product",
    targetId: id,
    timestamp: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}
