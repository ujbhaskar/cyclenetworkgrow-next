import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isSyntheticEmail, normalizePhone, syntheticEmailToPhone } from "@/lib/auth/phone";
import type { UserProfile, UserProfileSignupInput } from "@/lib/models/user";

export type { Role, UserProfile, UserProfileSignupInput } from "@/lib/models/user";

type DecodedForProfile = {
  uid: string;
  email?: string;
  name?: string;
};

/**
 * Creates or refreshes a rider's `users/{uid}` Firestore profile. Called
 * server-side right after session establishment (signup, login, Google) so
 * the client can never set its own `role` or spoof another uid's identity —
 * see docs/ARCHITECTURE.md §9.
 *
 * Safe to call on every login, not just signup: on an existing doc it only
 * merges derived fields (email/phone/displayName) and never touches `role`
 * or `createdAt`, and falls back to whatever is already stored for
 * firstName/lastName/address when the caller didn't supply new values.
 */
export async function upsertUserProfile(
  decoded: DecodedForProfile,
  profileInput?: UserProfileSignupInput
): Promise<void> {
  const ref = adminDb.collection("users").doc(decoded.uid);
  const existing = await ref.get();
  const existingData = existing.data() as Partial<UserProfile> | undefined;

  const email = decoded.email && !isSyntheticEmail(decoded.email) ? decoded.email : null;
  const phone =
    decoded.email && isSyntheticEmail(decoded.email)
      ? syntheticEmailToPhone(decoded.email)
      : profileInput?.phone
        ? normalizePhone(profileInput.phone)
        : existingData?.phone ?? null;

  const [googleFirst, ...googleRest] = decoded.name?.split(" ") ?? [];
  const firstName = profileInput?.firstName || existingData?.firstName || googleFirst || null;
  const lastName = profileInput?.lastName || existingData?.lastName || googleRest.join(" ") || null;
  const address = profileInput?.address || existingData?.address || null;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || phone || "Rider";

  const data: Omit<UserProfile, "role" | "createdAt"> = {
    uid: decoded.uid,
    email,
    phone,
    firstName,
    lastName,
    displayName,
    address,
    stravaConnected: existingData?.stravaConnected ?? false,
    organizationId: existingData?.organizationId ?? null,
  };

  if (!existing.exists) {
    await ref.set({ ...data, role: "rider", createdAt: new Date().toISOString() });
  } else {
    await ref.set(data, { merge: true });
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.exists ? (doc.data() as UserProfile) : null;
}

/** Flips the `users/{uid}` mirror of the Strava connection state — see src/lib/strava.ts. */
export async function setStravaConnected(uid: string, connected: boolean): Promise<void> {
  await adminDb.collection("users").doc(uid).set({ stravaConnected: connected }, { merge: true });
}

export class ProfileUpdateError extends Error {}

/**
 * Self-service profile edit (the /profile page) — distinct from
 * upsertUserProfile above, whose `decoded.email`/`decoded.name` params are
 * meant to come from a freshly-verified auth token, not arbitrary user
 * input. A changed `email` here updates Firebase Auth itself (the actual
 * sign-in credential — see docs/ARCHITECTURE.md §4), not just the Firestore
 * mirror, so the user can still log in with their new email afterwards.
 */
export async function updateOwnProfile(
  uid: string,
  fields: { firstName: string; lastName?: string; phone?: string; address?: string; email?: string }
): Promise<void> {
  const ref = adminDb.collection("users").doc(uid);
  const existing = (await ref.get()).data() as Partial<UserProfile> | undefined;

  let email = existing?.email ?? null;
  if (fields.email && fields.email !== existing?.email) {
    if (isSyntheticEmail(fields.email)) {
      throw new ProfileUpdateError("That email address isn't valid");
    }
    try {
      await adminAuth.updateUser(uid, { email: fields.email });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        throw new ProfileUpdateError("That email is already in use by another account");
      }
      if (code === "auth/invalid-email") {
        throw new ProfileUpdateError("That email address isn't valid");
      }
      throw err;
    }
    email = fields.email;
  }

  const firstName = fields.firstName;
  const lastName = fields.lastName || existing?.lastName || null;
  const phone = fields.phone ? normalizePhone(fields.phone) : existing?.phone ?? null;
  const address = fields.address || existing?.address || null;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || phone || "Rider";

  await ref.set({ email, firstName, lastName, phone, address, displayName }, { merge: true });
}
