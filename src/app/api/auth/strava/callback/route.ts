import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/dal";
import { getUserProfile, setStravaConnected } from "@/lib/user-profile";
import { exchangeStravaCode, saveStravaConnection } from "@/lib/strava";

/**
 * @swagger
 * /api/auth/strava/callback:
 *   get:
 *     summary: Strava OAuth callback
 *     description: Strava redirects here after consent. Exchanges the code for tokens server-side (never in the browser — see docs/ARCHITECTURE.md §5) and stores the connection.
 *     tags:
 *       - Strava
 *     responses:
 *       307:
 *         description: Redirects back to /profile with a status query param
 */
export async function GET(request: Request) {
  // Redirects to /login itself if there's no session — a rider must already
  // be logged into this app before connecting Strava.
  const session = await verifySession();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Cloud Run's `request.url` resolves to the container's internal bind
  // address (0.0.0.0:8080), not the public host — same reason /profile
  // builds its redirect_uri from these headers instead.
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? url.host;
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const profileUrl = new URL("/profile", `${protocol}://${host}`);

  if (error || !code) {
    profileUrl.searchParams.set("strava_error", error ?? "missing_code");
    return NextResponse.redirect(profileUrl);
  }

  const profile = await getUserProfile(session.uid);
  if (!profile?.phone) {
    // The legacy schema keys connections by phone — nothing to attach this
    // connection to without one on file.
    profileUrl.searchParams.set("strava_error", "no_phone_on_file");
    return NextResponse.redirect(profileUrl);
  }

  try {
    const tokens = await exchangeStravaCode(code);
    await saveStravaConnection(tokens, profile.phone);
    await setStravaConnected(session.uid, true);
    profileUrl.searchParams.set("strava_connected", "1");
  } catch (err) {
    console.error("[strava callback] token exchange/save failed:", err);
    profileUrl.searchParams.set("strava_error", "exchange_failed");
  }

  return NextResponse.redirect(profileUrl);
}
