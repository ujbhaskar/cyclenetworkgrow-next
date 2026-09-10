import { requireRole } from "@/lib/auth/dal";
import { setHeroStats } from "@/lib/hero-stats";
import type { HeroStatInput } from "@/lib/models/hero-stats";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/hero-stats:
 *   patch:
 *     summary: Replace the home page hero's stat tiles
 *     description: Requires admin role. Fully admin-authored list — free-text label and value per tile, added/removed/reordered as a whole. Replaces every existing tile with the given list.
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
 *             required: [stats]
 *             properties:
 *               stats:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                     value:
 *                       type: string
 *     responses:
 *       200:
 *         description: OK
 */
export async function PATCH(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body?.stats)) {
    return Response.json({ error: "stats must be an array" }, { status: 400 });
  }

  const stats: HeroStatInput[] = [];
  for (const item of body.stats) {
    if (typeof item?.label !== "string" || typeof item?.value !== "string") {
      return Response.json({ error: "Each tile needs a label and value" }, { status: 400 });
    }
    const label = item.label.trim();
    const value = item.value.trim();
    if (!label || !value) {
      return Response.json({ error: "Label and value can't be empty" }, { status: 400 });
    }
    if (label.length > 40 || value.length > 20) {
      return Response.json({ error: "Label must be under 40 characters, value under 20" }, { status: 400 });
    }
    stats.push({ label, value });
  }

  await setHeroStats(stats, session.uid);
  return Response.json({ ok: true });
}
