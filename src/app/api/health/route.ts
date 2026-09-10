/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     description: Returns 200 if the app server is up. Does not check Firestore/Auth connectivity.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
export async function GET() {
  return Response.json({ status: "ok" });
}
