import type { User } from "firebase/auth";
import type { UserProfileSignupInput } from "@/lib/models/user";

export async function establishSession(user: User, profile?: UserProfileSignupInput): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, profile }),
  });
  if (!res.ok) {
    throw new Error("Failed to establish session");
  }
}
