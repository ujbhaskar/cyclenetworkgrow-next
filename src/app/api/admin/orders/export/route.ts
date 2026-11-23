import { requireRole } from "@/lib/auth/dal";
import { buildOrdersXlsx } from "@/lib/admin-orders-export";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/orders/export:
 *   get:
 *     summary: Download all shop orders as an Excel file (admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: .xlsx file
 */
export async function GET() {
  await requireRole("admin");
  const report = await buildOrdersXlsx();
  return new Response(new Uint8Array(report.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
