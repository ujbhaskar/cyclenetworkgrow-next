import { requireRole } from "@/lib/auth/dal";
import { buildEventReportXlsx } from "@/lib/admin-event-report";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /api/admin/events/{id}/report:
 *   get:
 *     summary: Download the event's rider report as an Excel file (admin only)
 *     description: >
 *       One row per ranked rider — rank, name, address (profile first, then event
 *       registration), city, state, pin, category km, total points, total km, qualified, phone.
 *     tags:
 *       - Admin
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: .xlsx file
 *       404:
 *         description: Event not found
 */
export async function GET(_request: Request, { params }: RouteParams) {
  await requireRole("admin");
  const { id } = await params;
  const report = await buildEventReportXlsx(id);
  if (!report) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  return new Response(new Uint8Array(report.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
