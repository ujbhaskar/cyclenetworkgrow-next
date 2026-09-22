import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import { adminDb } from "@/lib/firebase/admin";
import { looksLikeEmail, normalizePhone } from "@/lib/auth/phone";
import { generateTemporaryPassword, setUserPassword } from "@/lib/auth/admin-users";
import type { Role, UserProfile } from "@/lib/models/user";
import { invalidateEventLeaderboardCache } from "@/lib/rider-metrics";

export async function listAllUsers(): Promise<UserProfile[]> {
  const snapshot = await adminDb.collection("users").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as UserProfile);
}

/**
 * Sets a user's role — the custom claim (the actual authorization source
 * the DAL reads, see docs/ARCHITECTURE.md §4) and the Firestore mirror
 * (for listing/display) together, so they never drift apart.
 *
 * Custom claims only take effect on the user's next session — an
 * already-logged-in browser keeps its old role until it logs in again.
 */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  const user = await adminAuth.getUser(uid);
  await adminAuth.setCustomUserClaims(uid, { ...user.customClaims, role });
  await adminDb.collection("users").doc(uid).set({ role }, { merge: true });
}

export async function deleteUserCompletely(uid: string): Promise<void> {
  await Promise.all([
    adminAuth.deleteUser(uid).catch(() => undefined),
    adminDb.collection("users").doc(uid).delete(),
  ]);
}

export type AdminEditableProfileFields = {
  firstName: string;
  lastName?: string;
  city?: string;
  state?: string;
  phone?: string;
};

/**
 * Admin-driven correction for a rider's own name/city/state/phone —
 * riders often typo these at signup or Strava-connect time and aren't
 * always comfortable finding My Profile themselves, so an admin fixes it
 * directly from the Users list instead. Unlike updateOwnProfile
 * (user-profile.ts), never touches Firebase Auth: email is the actual
 * sign-in credential there and isn't editable here, and a phone edit only
 * updates the Firestore mirror (the same limitation self-service profile
 * edits already have — a changed phone doesn't retroactively move the
 * synthetic-email login credential derived from the old one).
 */
export async function updateUserProfileByAdmin(uid: string, fields: AdminEditableProfileFields): Promise<void> {
  const ref = adminDb.collection("users").doc(uid);
  const existing = (await ref.get()).data() as Partial<UserProfile> | undefined;

  const firstName = fields.firstName.trim() || null;
  const lastName = fields.lastName?.trim() || null;
  const city = fields.city?.trim() || null;
  const state = fields.state?.trim() || null;
  const phone = fields.phone?.trim() ? normalizePhone(fields.phone) : null;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || existing?.email || phone || "User";

  await ref.set({ firstName, lastName, city, state, phone, displayName }, { merge: true });
  invalidateEventLeaderboardCache();
}

export type CreateUserByAdminInput = {
  identifier: string; // email or phone
  password?: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  address?: string;
};

export type CreateUserByAdminResult = {
  uid: string;
  password: string;
};

/**
 * Admin-driven account creation — same offline-communication use case as
 * the standalone "set password" tool, but also sets a role and profile
 * fields in one step. Uses the identifier's real email if given one, or
 * derives a synthetic email if given a phone number (see
 * docs/ARCHITECTURE.md §4) — same rule the rest of the app follows.
 */
export async function createUserByAdmin(input: CreateUserByAdminInput): Promise<CreateUserByAdminResult> {
  const password = input.password && input.password.length >= 6 ? input.password : generateTemporaryPassword();
  const { uid } = await setUserPassword(input.identifier, password);

  await adminAuth.setCustomUserClaims(uid, { role: input.role });

  const isEmail = looksLikeEmail(input.identifier);
  const email = isEmail ? input.identifier : null;
  const phone = isEmail ? null : normalizePhone(input.identifier);
  const displayName =
    [input.firstName, input.lastName].filter(Boolean).join(" ") || email || phone || "User";

  const profile: UserProfile = {
    uid,
    role: input.role,
    email,
    phone,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    displayName,
    address: input.address ?? null,
    city: null,
    state: null,
    pincode: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    stravaConnected: false,
    createdAt: new Date().toISOString(),
    organizationId: null,
  };
  await adminDb.collection("users").doc(uid).set(profile, { merge: true });

  return { uid, password };
}
