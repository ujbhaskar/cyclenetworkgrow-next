"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

// Shown site-wide whenever the current session was started via the admin
// "Log in as" tool (see ImpersonateButton.tsx) — impossible to miss so an
// admin never forgets they're looking at the site as someone else, and a
// one-click way back out. Ending impersonation just logs out entirely
// (there's no stored admin credential to silently restore), so the admin
// logs back in normally afterwards.
export default function ImpersonationBanner({ riderName }: { riderName: string }) {
  const [pending, setPending] = useState(false);

  async function handleEnd() {
    setPending(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard reload to fully clear the impersonated client Firebase Auth identity
      window.location.assign("/login");
    }
  }

  return (
    // Explicit position + a z-index above Header's own (10) — on the home
    // page and event detail pages, Header floats transparently over the
    // hero via `position: absolute; z-index: 10` with no positioned
    // ancestor, so it's anchored to the true top of the page just like this
    // banner is. Without out-stacking it here, Header's (invisible, since
    // transparent there) box sits on top and swallows clicks meant for
    // this banner's buttons.
    <div
      className="d-flex flex-wrap align-items-center justify-content-center gap-2 bg-warning text-dark text-center py-2 px-3 small fw-medium"
      style={{ position: "relative", zIndex: 20 }}
    >
      <i className="bi bi-incognito" aria-hidden />
      Viewing as <strong>{riderName}</strong> (admin impersonation)
      <button
        type="button"
        className="btn btn-dark btn-sm ms-2"
        onClick={handleEnd}
        disabled={pending}
      >
        {pending ? "Ending…" : "End impersonation"}
      </button>
    </div>
  );
}
