"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import type { NewRiderPreview } from "@/lib/legacy-registrations";

export default function RegistrationSyncPanel({
  eventId,
  sheetName,
}: {
  eventId: string;
  sheetName: string | null;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NewRiderPreview | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setPreview(null);
    setAddedCount(null);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/sync-registrations`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't check for new registrations");
      }
      setPreview(body as NewRiderPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check for new registrations");
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirm() {
    if (!preview || preview.newRiders.length === 0) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/sync-registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones: preview.newRiders.map((r) => r.phone) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't add the new riders");
      }
      setAddedCount(body.added ?? 0);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the new riders");
    } finally {
      setConfirming(false);
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
        Reads the <code>{sheetName}</code> tab of the shared registrations spreadsheet and shows any new riders not
        already registered for this event — nobody already registered is changed or removed, including any manual
        corrections made from the table below.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {addedCount !== null && (
        <Alert variant="success">
          Added {addedCount} new rider{addedCount === 1 ? "" : "s"} to this event.
        </Alert>
      )}

      {preview && preview.newRiders.length === 0 && (
        <Alert variant="info">No new users — all riders from the sheet are already registered for this event.</Alert>
      )}

      {preview && preview.newRiders.length > 0 && (
        <Alert variant="warning">
          <p className="fw-semibold mb-2">
            {preview.newRiders.length} new rider{preview.newRiders.length === 1 ? "" : "s"} found in the sheet —
            confirm to add {preview.newRiders.length === 1 ? "it" : "them"} to this event.
          </p>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <Table size="sm" bordered className="mb-3 bg-white">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {preview.newRiders.map((rider) => (
                  <tr key={rider.phone} className="table-warning">
                    <td>{rider.full_name || "—"}</td>
                    <td>{rider.phone}</td>
                    <td>{rider.city || "—"}</td>
                    <td>{rider.state || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" onClick={handleConfirm} disabled={confirming}>
              {confirming ? "Adding…" : `Confirm and add ${preview.newRiders.length}`}
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setPreview(null)} disabled={confirming}>
              Cancel
            </Button>
          </div>
        </Alert>
      )}

      <Button onClick={handleCheck} disabled={checking}>
        {checking ? "Checking…" : "Check for new registrations"}
      </Button>
    </div>
  );
}
