import { requireRole } from "@/lib/auth/dal";
import { adminBucket } from "@/lib/firebase/admin";
import { setHomeHeroImageUrl } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * @swagger
 * /api/admin/hero-banner:
 *   post:
 *     summary: Upload a new home page hero background image
 *     description: Requires admin role. Uploads the image to Firebase Storage and records it as the active banner in Firestore (siteSettings/homeHero) — the public Hero component reads this on every render.
 *     tags:
 *       - Admin
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: The new banner's public URL
 */
export async function POST(request: Request) {
  const session = await requireRole("admin");

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `site/hero-banner/${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const storageFile = adminBucket.file(path);
  await storageFile.save(buffer, { contentType: file.type });
  await storageFile.makePublic();

  const imageUrl = `https://storage.googleapis.com/${adminBucket.name}/${path}`;
  await setHomeHeroImageUrl(imageUrl, session.uid);

  return Response.json({ imageUrl });
}
