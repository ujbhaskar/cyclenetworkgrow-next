"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "react-bootstrap/Button";

export default function DisconnectStravaButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect your Strava account? Ride syncing will stop until you reconnect.")) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/profile/strava", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("failed");
      }
      router.refresh();
    } catch {
      setError("Couldn't disconnect Strava. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline-danger" size="sm" onClick={handleDisconnect} disabled={pending}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      {error && <p className="text-danger small mt-2 mb-0">{error}</p>}
    </>
  );
}
