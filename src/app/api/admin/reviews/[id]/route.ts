import { requireRole } from "@/lib/auth/dal";
import { deleteTestimonial, reviewTestimonial } from "@/lib/testimonials";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/reviews/{id}:
 *   patch:
 *     summary: Approve or discard a submitted testimonial
 *     description: Requires admin role. Approved testimonials appear in the home page carousel; discarded ones are kept (not deleted) for record — see docs/ARCHITECTURE.md §8.3.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, discarded]
 *     responses:
 *       200:
 *         description: OK
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireRole("admin");
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (body?.status !== "approved" && body?.status !== "discarded") {
    return Response.json({ error: "status must be 'approved' or 'discarded'" }, { status: 400 });
  }

  await reviewTestimonial(id, body.status, session.uid);
  return Response.json({ ok: true });
}

/**
 * @swagger
 * /api/admin/reviews/{id}:
 *   delete:
 *     summary: Permanently delete a testimonial
 *     description: Requires admin role. A real delete, not a status change — for clearing out spam/test submissions.
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
 *         description: OK
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  await requireRole("admin");
  const { id } = await params;
  await deleteTestimonial(id);
  return Response.json({ ok: true });
}
