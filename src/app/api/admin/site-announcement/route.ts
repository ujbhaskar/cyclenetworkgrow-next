import { requireRole } from "@/lib/auth/dal";
import { getSiteAnnouncement, updateSiteAnnouncement } from "@/lib/site-announcement";
import { ANNOUNCEMENT_VARIANTS, type SiteAnnouncement } from "@/lib/models/site-announcement";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/site-announcement:
 *   get:
 *     summary: Current home page announcement banner config
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: SiteAnnouncement
 */
export async function GET() {
  await requireRole("admin");
  const announcement = await getSiteAnnouncement();
  return Response.json(announcement);
}

/**
 * @swagger
 * /api/admin/site-announcement:
 *   put:
 *     summary: Update the home page announcement banner
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid values
 */
export async function PUT(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const enabled = Boolean(body?.enabled);
  const variant = body?.variant;

  if (!ANNOUNCEMENT_VARIANTS.includes(variant)) {
    return Response.json({ error: `variant must be one of: ${ANNOUNCEMENT_VARIANTS.join(", ")}` }, { status: 400 });
  }
  if (message.length > 300) {
    return Response.json({ error: "Message must be under 300 characters" }, { status: 400 });
  }
  if (enabled && !message) {
    return Response.json({ error: "Add a message before enabling the banner" }, { status: 400 });
  }

  const announcement: SiteAnnouncement = { enabled, message, variant };
  await updateSiteAnnouncement(announcement, session.uid);

  return Response.json(announcement);
}
