import "server-only";
import { adminDb } from "@/lib/firebase/admin";

// Same (misspelled) collection src/lib/strava.ts already uses.
export const ATHLETE_TOKENS_COLLECTION = "athelete_tokens"; // sic

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export type StravaTokenDoc = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { id?: number | string; phone?: string };
};

export async function findStravaTokenDocByPhone(
  phone: string,
): Promise<{ athleteId: string; data: StravaTokenDoc } | null> {
  const snapshot = await adminDb.collection(ATHLETE_TOKENS_COLLECTION).where("athlete.phone", "==", phone).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? { athleteId: doc.id, data: doc.data() as StravaTokenDoc } : null;
}

// The token doc's id IS the Strava athlete id (see strava.ts's
// saveStravaConnection), so this is a direct lookup, not a query.
export async function findStravaTokenDocById(
  athleteId: string,
): Promise<{ athleteId: string; data: StravaTokenDoc } | null> {
  const doc = await adminDb.collection(ATHLETE_TOKENS_COLLECTION).doc(athleteId).get();
  return doc.exists ? { athleteId: doc.id, data: doc.data() as StravaTokenDoc } : null;
}

async function refreshStravaToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Never the legacy admin's pattern of doing this refresh (and activity
// fetches) directly from the browser with the client secret typed into a
// form field — see docs/REQUIREMENTS.md §4's note on this being "a fix, not
// a carry-over". Both stay server-side, here and everywhere this is used.
export async function getValidStravaAccessToken(athleteId: string, data: StravaTokenDoc): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (data.access_token && data.expires_at && data.expires_at > nowSeconds + 60) {
    return data.access_token;
  }
  if (!data.refresh_token) {
    throw new Error("No refresh token on file for this rider — they'll need to reconnect Strava.");
  }
  const refreshed = await refreshStravaToken(data.refresh_token);
  await adminDb.collection(ATHLETE_TOKENS_COLLECTION).doc(athleteId).update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
  });
  return refreshed.access_token;
}
