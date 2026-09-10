"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import Button from "react-bootstrap/Button";
import { auth } from "@/lib/firebase/client";
import { establishSession } from "@/lib/auth/establish-session";

export default function GoogleSignInButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await establishSession(credential.user);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Google sign-in failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline-secondary" className="w-100" onClick={handleClick} disabled={pending}>
        <i className="bi bi-google me-2" aria-hidden />
        Continue with Google
      </Button>
      {error && <p className="text-danger small mt-2 mb-0">{error}</p>}
    </>
  );
}
