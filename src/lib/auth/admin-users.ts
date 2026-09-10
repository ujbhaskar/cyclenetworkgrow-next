import "server-only";
import crypto from "node:crypto";
import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { looksLikeEmail, normalizePhone, phoneToSyntheticEmail } from "@/lib/auth/phone";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 10): string {
  return Array.from(crypto.randomFillSync(new Uint8Array(length)))
    .map((byte) => PASSWORD_CHARS[byte % PASSWORD_CHARS.length])
    .join("");
}

export type SetPasswordResult = { uid: string; created: boolean };

/**
 * Admin-driven password set/reset — used when a rider isn't reachable via
 * email/SMS and the admin will hand them the password offline. Creates the
 * account if it doesn't exist yet.
 */
export async function setUserPassword(identifier: string, password: string): Promise<SetPasswordResult> {
  return looksLikeEmail(identifier)
    ? setPasswordForEmail(identifier, password)
    : setPasswordForPhone(identifier, password);
}

async function setPasswordForEmail(email: string, password: string): Promise<SetPasswordResult> {
  const user = await findUser(() => adminAuth.getUserByEmail(email));

  if (!user) {
    const created = await adminAuth.createUser({ email, password });
    return { uid: created.uid, created: true };
  }

  await adminAuth.updateUser(user.uid, { password });
  return { uid: user.uid, created: false };
}

async function setPasswordForPhone(rawPhone: string, password: string): Promise<SetPasswordResult> {
  const phone = normalizePhone(rawPhone);
  const syntheticEmail = phoneToSyntheticEmail(phone);

  // The synthetic email is the source of truth for phone accounts created
  // through this app (signup/login never touch Auth's native phoneNumber
  // field). Fall back to a phoneNumber lookup for legacy accounts migrated
  // from the old pure-phone-OTP system, which won't have that email yet.
  const user =
    (await findUser(() => adminAuth.getUserByEmail(syntheticEmail))) ??
    (await findUser(() => adminAuth.getUserByPhoneNumber(phone)));

  if (!user) {
    const created = await adminAuth.createUser({ email: syntheticEmail, password });
    return { uid: created.uid, created: true };
  }

  const updates: { password: string; email?: string } = { password };
  if (!user.email) {
    updates.email = syntheticEmail;
  }
  await adminAuth.updateUser(user.uid, updates);
  return { uid: user.uid, created: false };
}

async function findUser(lookup: () => Promise<UserRecord>): Promise<UserRecord | undefined> {
  try {
    return await lookup();
  } catch {
    return undefined;
  }
}
