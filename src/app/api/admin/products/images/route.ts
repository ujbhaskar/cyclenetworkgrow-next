import { requireRole } from "@/lib/auth/dal";
import { adminBucket } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * @swagger
 * /api/admin/products/images:
 *   post:
 *     summary: Upload one product image
 *     description: Requires admin role. Stores the image in Firebase Storage and returns its public URL — the product form collects these URLs into the product's ordered `images` array.
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
 *         description: "{ url: string }"
 *       400:
 *         description: Missing, wrong type, or too large
 */
export async function POST(request: Request) {
  await requireRole("admin");

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return Response.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const path = `shop/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const storageFile = adminBucket.file(path);
  await storageFile.save(Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  await storageFile.makePublic();

  return Response.json({ url: `https://storage.googleapis.com/${adminBucket.name}/${path}` });
}
