import { verifySession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import { submitTestimonial } from "@/lib/testimonials";

export const dynamic = "force-dynamic";

const MAX_QUOTE_LENGTH = 600;
const MAX_TITLE_LENGTH = 60;

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Submit a testimonial for admin review
 *     description: Any signed-in user (rider, manager, or admin) can submit one. Saved with status "pending" — see docs/ARCHITECTURE.md §8.3. If the submitter has a connected Strava profile, its photo is attached automatically.
 *     tags:
 *       - Reviews
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quote]
 *             properties:
 *               quote:
 *                 type: string
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
export async function POST(request: Request) {
  const session = await verifySession();
  const body = await request.json().catch(() => null);
  const quote = typeof body?.quote === "string" ? body.quote.trim() : "";
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : null;

  if (!quote) {
    return Response.json({ error: "Review text is required" }, { status: 400 });
  }
  if (quote.length > MAX_QUOTE_LENGTH) {
    return Response.json({ error: `Review must be under ${MAX_QUOTE_LENGTH} characters` }, { status: 400 });
  }
  if (title && title.length > MAX_TITLE_LENGTH) {
    return Response.json({ error: `Title must be under ${MAX_TITLE_LENGTH} characters` }, { status: 400 });
  }

  const profile = await getUserProfile(session.uid);

  await submitTestimonial({
    uid: session.uid,
    submittedByName: profile?.displayName ?? "A rider",
    phone: profile?.phone ?? null,
    quote,
    title,
  });

  return Response.json({ ok: true });
}
