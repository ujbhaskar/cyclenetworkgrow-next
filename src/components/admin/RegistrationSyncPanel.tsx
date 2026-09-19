"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import type { RegistrationSyncResult } from "@/lib/legacy-registrations";

export default function RegistrationSyncPanel({
  eventId,
  sheetName,
}: {
  eventId: string;
  sheetName: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationSyncResult | null>(null);

  async function handleSync() {
    if (
      !confirm(
        `This REPLACES this event's whole rider list with what's currently in the "${sheetName}" sheet tab (cross-referenced against connected Strava riders). Any rider added some other way — not present in that sheet — will be removed. Continue?`
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/admin/legacy-events/${eventId}/sync-registrations`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setResult(body);
      router.refresh();
    } else {
      setError(body.error ?? "Sync failed.");
    }
  }

  if (!sheetName) {
    return (
      <Alert variant="warning" className="mb-0">
        This event has no registration sheet configured (<code>registeredGoogleDataXLS</code> is empty) — nothing to
        sync from.
      </Alert>
    );
  }

  return (
    <div>
      <p className="text-muted mb-3">
        Reads the <code>{sheetName}</code> tab of the shared registrations spreadsheet, keeps captured Razorpay
        payments only, and rebuilds this event&apos;s rider list from it.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {result && (
        <Alert variant="success">
          Synced from <code>{result.sheetName}</code>: {result.totalRows} rows read, {result.capturedRows} captured
          payments, {result.uniqueRegistrations} unique riders ({result.matchedWithStrava} already Strava-connected).
        </Alert>
      )}

      <Button onClick={handleSync} disabled={pending}>
        {pending ? "Syncing…" : "Sync users from registrations"}
      </Button>
    </div>
  );
}
