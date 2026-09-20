import { requireRole } from "@/lib/auth/dal";
import { setNavLinks } from "@/lib/nav-links";
import type { NavLinkInput } from "@/lib/models/nav-links";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/nav-links:
 *   patch:
 *     summary: Replace the main site header's nav links
 *     description: Requires admin role. Fully admin-authored list — label and href per link, added/removed/reordered as a whole. Replaces every existing link with the given list.
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
 *             required: [links]
 *             properties:
 *               links:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                     href:
 *                       type: string
 *     responses:
 *       200:
 *         description: OK
 */
export async function PATCH(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body?.links) || body.links.length === 0) {
    return Response.json({ error: "links must be a non-empty array" }, { status: 400 });
  }

  const links: NavLinkInput[] = [];
  for (const item of body.links) {
    if (typeof item?.label !== "string" || typeof item?.href !== "string") {
      return Response.json({ error: "Each link needs a label and href" }, { status: 400 });
    }
    const label = item.label.trim();
    const href = item.href.trim();
    if (!label || !href) {
      return Response.json({ error: "Label and href can't be empty" }, { status: 400 });
    }
    if (!href.startsWith("/") && !href.startsWith("http://") && !href.startsWith("https://")) {
      return Response.json({ error: `"${href}" must start with / or http(s)://` }, { status: 400 });
    }
    if (label.length > 30 || href.length > 200) {
      return Response.json({ error: "Label must be under 30 characters, href under 200" }, { status: 400 });
    }
    links.push({ label, href });
  }

  await setNavLinks(links, session.uid);
  return Response.json({ ok: true });
}
