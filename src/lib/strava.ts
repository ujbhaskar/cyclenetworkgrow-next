import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeIndianState } from "@/lib/india-states";

// Same production collection the legacy Angular app (and this app's own
// read-only rider-metrics.ts) already uses — deliberately NOT a new
// collection, so a rider who connects here shows up connected everywhere,
// and vice versa. Doc id is the Strava athlete id (a string), not the
// rider's phone — see letscng-api's stravaTokenController.js, the existing
// writer this schema is copied from.
const STRAVA_TOKENS_COLLECTION = "athelete_tokens"; // sic — matches the real (misspelled) collection name

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";
const STRAVA_PUSH_SUBSCRIPTIONS_URL = "https://www.strava.com/api/v3/push_subscriptions";

// Verifies the GET handshake Strava makes to a callback_url before
// accepting a new subscription (see src/app/api/strava/webhook/route.ts).
// Distinct from the legacy Angular app's own token ("letscngSubscription")
// — doesn't need to match it, each subscription's verify_token is only
// ever compared against what that same subscription was created with.
export const STRAVA_WEBHOOK_VERIFY_TOKEN = "cyclenetworkgrow_subscription";

// Read-only activity access — no write scope needed, this app never posts
// to Strava on a rider's behalf.
const STRAVA_SCOPE = "read,activity:read";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * The legacy app's phone format has no country code (Angular's
 * getPhoneNumber() strips "+91"/"+1"). This app stores phone in E.164
 * (normalizePhone in src/lib/auth/phone.ts). Converting here — rather than
 * changing the legacy format — is what keeps this app's connections visible
 * to the existing rider-metrics.ts reader and the old Angular app alike.
 */
export function toLegacyPhone(e164Phone: string): string {
  return e164Phone.replace(/^\+91/, "").replace(/^\+1/, "").replace(/^\+/, "");
}

export type StravaConnection = {
  athleteId: string;
  firstName: string | null;
  lastName: string | null;
  /** Raw, as Strava/the rider's profile reports it — free text, keep for display. */
  city: string | null;
  /** Raw, as Strava/the rider's profile reports it — free text, keep for display. */
  state: string | null;
  profileImageUrl: string | null;
  /** Legacy bare-digit format, as stored — see toLegacyPhone above. For admin display/identification, not for matching against this app's own (E.164) UserProfile.phone. */
  phone: string | null;
  /** This app's users/{uid}, matched by phone — set only by listStravaConnections(); null elsewhere. */
  linkedUid: string | null;
  /** Best available city: the linked profile's (structured, if the rider filled it in) or the raw Strava text. Only meaningfully resolved by listStravaConnections(). */
  resolvedCity: string | null;
  /** Best available state: the linked profile's (structured) or normalizeIndianState(raw). Only meaningfully resolved by listStravaConnections(). */
  resolvedState: string | null;
};

type LegacyAthleteTokenDoc = {
  access_token?: string;
  athlete?: {
    id?: string | number;
    firstname?: string;
    lastname?: string;
    city?: string;
    state?: string;
    profile?: string;
    phone?: string;
  };
};

function mapConnection(id: string, data: LegacyAthleteTokenDoc): StravaConnection {
  const city = data.athlete?.city ?? null;
  const state = data.athlete?.state ?? null;
  return {
    athleteId: id,
    firstName: data.athlete?.firstname ?? null,
    lastName: data.athlete?.lastname ?? null,
    city,
    state,
    profileImageUrl: data.athlete?.profile ?? null,
    phone: data.athlete?.phone ?? null,
    // Only listStravaConnections() below does the users/{uid} join; a
    // single lookup (getStravaConnectionByPhone, used by the rider's own
    // profile page) has no need for it, so these fall back to whatever
    // resolves from the raw Strava text alone.
    linkedUid: null,
    resolvedCity: city,
    resolvedState: normalizeIndianState(state),
  };
}

/** Looks up an existing Strava connection by the rider's (E.164) phone. */
export async function getStravaConnectionByPhone(e164Phone: string): Promise<StravaConnection | null> {
  const legacyPhone = toLegacyPhone(e164Phone);
  const snapshot = await adminDb
    .collection(STRAVA_TOKENS_COLLECTION)
    .where("athlete.phone", "==", legacyPhone)
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? mapConnection(doc.id, doc.data() as LegacyAthleteTokenDoc) : null;
}

type LinkedUserSummary = { uid: string; city: string | null; state: string | null };

/**
 * All Strava connections, for the admin "Strava-Connected Riders" list —
 * see docs/ARCHITECTURE.md §7.1. Joins each connection to a `users/{uid}`
 * profile by phone (the only identifier Strava's stored data and this app's
 * own profiles have in common — Strava doesn't give us an email), and
 * prefers that profile's structured city/state (from the signup/profile
 * pin+city+state fields) over Strava's free-text ones when a match exists.
 * Riders who never signed up here, or don't have a phone on file, fall back
 * to normalizeIndianState() on Strava's raw text — see src/lib/india-states.ts.
 */
export async function listStravaConnections(): Promise<StravaConnection[]> {
  const [tokensSnapshot, usersSnapshot] = await Promise.all([
    adminDb.collection(STRAVA_TOKENS_COLLECTION).get(),
    adminDb.collection("users").get(),
  ]);

  const userByLegacyPhone = new Map<string, LinkedUserSummary>();
  usersSnapshot.docs.forEach((doc) => {
    const data = doc.data() as { phone?: string | null; city?: string | null; state?: string | null };
    if (!data.phone) {
      return;
    }
    userByLegacyPhone.set(toLegacyPhone(data.phone), {
      uid: doc.id,
      city: data.city ?? null,
      state: data.state ?? null,
    });
  });

  return tokensSnapshot.docs
    .map((doc) => {
      const connection = mapConnection(doc.id, doc.data() as LegacyAthleteTokenDoc);
      const linked = connection.phone ? userByLegacyPhone.get(connection.phone) : undefined;
      return {
        ...connection,
        linkedUid: linked?.uid ?? null,
        resolvedCity: linked?.city || connection.resolvedCity,
        resolvedState: linked?.state || connection.resolvedState,
      };
    })
    .sort((a, b) => (a.firstName ?? "").localeCompare(b.firstName ?? ""));
}

/**
 * The Strava consent-screen URL. `redirectUri` is built per-request from the
 * incoming host (see the callback route) rather than hardcoded, so this
 * works on whichever domain is currently registered as this Strava API
 * app's "Authorization Callback Domain" — no code change needed if that
 * ever moves.
 */
export function getStravaAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname?: string;
    lastname?: string;
    city?: string;
    state?: string;
    sex?: string;
    profile?: string;
    profile_medium?: string;
  };
};

/**
 * Exchanges the OAuth `code` for tokens — server-side only, using the
 * client secret. The legacy Angular app does this exchange directly from
 * the browser with the secret embedded in its bundle (see
 * docs/ARCHITECTURE.md §5); this is the fix for that, not a copy of it.
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Stores the connection in the same shape/collection the legacy app writes. */
export async function saveStravaConnection(tokens: StravaTokenResponse, e164Phone: string): Promise<void> {
  const athleteId = String(tokens.athlete.id);
  await adminDb
    .collection(STRAVA_TOKENS_COLLECTION)
    .doc(athleteId)
    .set({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      athlete: {
        id: athleteId,
        firstname: tokens.athlete.firstname ?? null,
        lastname: tokens.athlete.lastname ?? null,
        city: tokens.athlete.city ?? null,
        state: tokens.athlete.state ?? null,
        sex: tokens.athlete.sex ?? null,
        profile: tokens.athlete.profile ?? null,
        profile_medium: tokens.athlete.profile_medium ?? null,
        phone: toLegacyPhone(e164Phone),
      },
    });
}

/**
 * Revokes the token with Strava (best-effort — a rider re-connecting is
 * fine even if this fails) and removes the stored connection.
 */
export async function disconnectStrava(athleteId: string): Promise<void> {
  const ref = adminDb.collection(STRAVA_TOKENS_COLLECTION).doc(athleteId);
  const doc = await ref.get();
  const accessToken = (doc.data() as LegacyAthleteTokenDoc | undefined)?.access_token;

  if (accessToken) {
    try {
      await fetch(STRAVA_DEAUTHORIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken }).toString(),
      });
    } catch {
      // Best-effort — still remove our copy even if Strava's side fails.
    }
  }

  await ref.delete();
}

export type StravaSubscription = {
  id: number;
  callbackUrl: string;
};

/**
 * The current webhook push subscription, if any. Strava allows **only one
 * subscription per Client ID, globally** — this app and the legacy Angular
 * app share the same Strava API application, so whichever one last created
 * a subscription is the one actually receiving every connected rider's
 * activity events, not just this app's own. See the admin Strava
 * Subscription page for the same caution shown there.
 */
export async function getStravaSubscription(): Promise<StravaSubscription | null> {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
  });
  const res = await fetch(`${STRAVA_PUSH_SUBSCRIPTIONS_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Strava push_subscriptions lookup failed: ${res.status} ${await res.text()}`);
  }
  const subscriptions: Array<{ id: number; callback_url: string }> = await res.json();
  const first = subscriptions[0];
  return first ? { id: first.id, callbackUrl: first.callback_url } : null;
}

/**
 * Creates the subscription — `callbackUrl` should point at
 * /api/strava/webhook on whichever domain is currently deployed (built
 * per-request from the incoming host, same pattern as
 * getStravaAuthorizeUrl). Strava calls that URL with a GET verification
 * challenge synchronously as part of this request; if it can't reach it or
 * the verify_token doesn't match, this throws.
 */
export async function createStravaSubscription(callbackUrl: string): Promise<StravaSubscription> {
  const res = await fetch(STRAVA_PUSH_SUBSCRIPTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      callback_url: callbackUrl,
      verify_token: STRAVA_WEBHOOK_VERIFY_TOKEN,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Strava subscription creation failed: ${res.status} ${await res.text()}`);
  }
  const created: { id: number } = await res.json();
  return { id: created.id, callbackUrl };
}

export async function deleteStravaSubscription(id: number): Promise<void> {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
  });
  const res = await fetch(`${STRAVA_PUSH_SUBSCRIPTIONS_URL}/${id}?${params.toString()}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Strava subscription delete failed: ${res.status} ${await res.text()}`);
  }
}
