import type { User } from "firebase/auth";
import type { UserProfileSignupInput } from "@/lib/models/user";

export type EstablishSessionResult = { stravaConnected: boolean };

export async function establishSession(
  user: User,
  options?: { profile?: UserProfileSignupInput; rememberMe?: boolean },
): Promise<EstablishSessionResult> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, profile: options?.profile, rememberMe: options?.rememberMe }),
  });
  if (!res.ok) {
    throw new Error("Failed to establish session");
  }
  const body = await res.json().catch(() => ({}));
  return { stravaConnected: Boolean(body.stravaConnected) };
}
