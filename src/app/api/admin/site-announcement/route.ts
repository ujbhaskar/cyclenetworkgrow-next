import { requireRole } from "@/lib/auth/dal";
import { listSiteAnnouncements, setSiteAnnouncements } from "@/lib/site-announcement";
import { ANNOUNCEMENT_VARIANTS, type SiteAnnouncementInput } from "@/lib/models/site-announcement";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/admin/site-announcement:
 *   get:
 *     summary: Every scheduled home page announcement banner
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ announcements: SiteAnnouncement[] }"
 */
export async function GET() {
  await requireRole("admin");
  const announcements = await listSiteAnnouncements();
  return Response.json({ announcements });
}

/**
 * @swagger
 * /api/admin/site-announcement:
 *   put:
 *     summary: Replace the full list of scheduled home page announcement banners
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Invalid values
 */
export async function PUT(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body?.announcements)) {
    return Response.json({ error: "announcements must be an array" }, { status: 400 });
  }

  const announcements: SiteAnnouncementInput[] = [];
  for (const item of body.announcements) {
    const message = typeof item?.message === "string" ? item.message.trim() : "";
    const variant = item?.variant;
    const startAt = typeof item?.startAt === "string" ? item.startAt : "";
    const endAt = typeof item?.endAt === "string" ? item.endAt : "";

    if (!message) {
      return Response.json({ error: "Every banner needs a message" }, { status: 400 });
    }
    if (message.length > 300) {
      return Response.json({ error: "Message must be under 300 characters" }, { status: 400 });
    }
    if (!ANNOUNCEMENT_VARIANTS.includes(variant)) {
      return Response.json({ error: `variant must be one of: ${ANNOUNCEMENT_VARIANTS.join(", ")}` }, { status: 400 });
    }
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return Response.json({ error: "Every banner needs a valid start and end time" }, { status: 400 });
    }
    if (startMs >= endMs) {
      return Response.json({ error: "A banner's start time must be before its end time" }, { status: 400 });
    }

    announcements.push({ message, variant, enabled: Boolean(item.enabled), startAt, endAt });
  }

  await setSiteAnnouncements(announcements, session.uid);
  return Response.json({ announcements });
}
