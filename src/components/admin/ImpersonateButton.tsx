"use client";

import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import Button from "react-bootstrap/Button";
import { auth } from "@/lib/firebase/client";
import { establishSession } from "@/lib/auth/establish-session";

export default function ImpersonateButton({ uid, disabled }: { uid: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImpersonate() {
    if (!confirm("View the site as this rider? You'll be signed in as them until you end impersonation.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${uid}/impersonate`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't start impersonation");
      }
      const credential = await signInWithCustomToken(auth, body.customToken);
      await establishSession(credential.user, { rememberMe: false });
      // Hard navigation, not router.push — swaps the entire client Firebase
      // Auth identity out from under the admin's session, so every already
      // -mounted component (Header, this table, etc.) needs a clean reload
      // rather than trusting stale client state to catch up.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard reload, see comment above
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start impersonation");
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline-secondary" onClick={handleImpersonate} disabled={disabled || pending}>
        {pending ? "Switching…" : "Log in as"}
      </Button>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </>
  );
}
