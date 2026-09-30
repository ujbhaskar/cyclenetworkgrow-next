"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import type { NewRiderPreview, StravaLinkCandidate } from "@/lib/legacy-registrations";
import type { RazorpayRegistrationPreview } from "@/lib/razorpay-registrations";

type CombinedPreview = NewRiderPreview & { stravaLinkCandidates: StravaLinkCandidate[] };
type CombinedRazorpayPreview = RazorpayRegistrationPreview & { stravaLinkCandidates: StravaLinkCandidate[] };

export default function RegistrationSyncPanel({
  eventId,
  sheetName,
  hasRazorpayPaymentLink,
}: {
  eventId: string;
  sheetName: string | null;
  hasRazorpayPaymentLink: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CombinedPreview | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const [linkedCount, setLinkedCount] = useState<number | null>(null);

  const [checkingRazorpay, setCheckingRazorpay] = useState(false);
  const [confirmingRazorpay, setConfirmingRazorpay] = useState(false);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);
  const [razorpayPreview, setRazorpayPreview] = useState<CombinedRazorpayPreview | null>(null);
  const [razorpayAddedCount, setRazorpayAddedCount] = useState<number | null>(null);

  // The Google Sheet section only ever shows when there's no Razorpay
  // payment link (see the render below) — so exactly one of `preview` /
  // `razorpayPreview` is ever populated at a time, and this single set of
  // Strava-link handlers/state can serve whichever one is active.
  const stravaLinkCandidates = hasRazorpayPaymentLink
    ? (razorpayPreview?.stravaLinkCandidates ?? [])
    : (preview?.stravaLinkCandidates ?? []);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setPreview(null);
    setAddedCount(null);
    setLinkedCount(null);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/sync-registrations`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't check for new registrations");
      }
      setPreview(body as CombinedPreview);
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
      setPreview((current) => (current ? { ...current, newRiders: [] } : current));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the new riders");
    } finally {
      setConfirming(false);
    }
  }

  function handleExcludeNewRider(phone: string) {
    setPreview((current) =>
      current ? { ...current, newRiders: current.newRiders.filter((r) => r.phone !== phone) } : current,
    );
  }

  /** Serves whichever section (Sheet or Razorpay) is currently active —
   * see the `stravaLinkCandidates` derivation above for why only one is
   * ever populated at a time. */
  async function handleConfirmStravaLinks() {
    if (stravaLinkCandidates.length === 0) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/strava-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones: stravaLinkCandidates.map((r) => r.phone) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't link Strava for these riders");
      }
      setLinkedCount(body.linked ?? 0);
      if (hasRazorpayPaymentLink) {
        setRazorpayPreview((current) => (current ? { ...current, stravaLinkCandidates: [] } : current));
      } else {
        setPreview((current) => (current ? { ...current, stravaLinkCandidates: [] } : current));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't link Strava for these riders");
    } finally {
      setLinking(false);
    }
  }

  function handleCancelStravaLinks() {
    if (hasRazorpayPaymentLink) {
      setRazorpayPreview((current) => (current ? { ...current, stravaLinkCandidates: [] } : current));
    } else {
      setPreview((current) => (current ? { ...current, stravaLinkCandidates: [] } : current));
    }
  }

  async function handleCheckRazorpay() {
    setCheckingRazorpay(true);
    setRazorpayError(null);
    setRazorpayPreview(null);
    setRazorpayAddedCount(null);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/sync-razorpay`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't check Razorpay for new registrations");
      }
      setRazorpayPreview(body as CombinedRazorpayPreview);
    } catch (err) {
      setRazorpayError(err instanceof Error ? err.message : "Couldn't check Razorpay for new registrations");
    } finally {
      setCheckingRazorpay(false);
    }
  }

  async function handleConfirmRazorpay() {
    if (!razorpayPreview || razorpayPreview.newRiders.length === 0) return;
    setConfirmingRazorpay(true);
    setRazorpayError(null);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/sync-razorpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones: razorpayPreview.newRiders.map((r) => r.phone) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't add the new riders");
      }
      setRazorpayAddedCount(body.added ?? 0);
      setRazorpayPreview((current) => (current ? { ...current, newRiders: [] } : current));
      router.refresh();
    } catch (err) {
      setRazorpayError(err instanceof Error ? err.message : "Couldn't add the new riders");
    } finally {
      setConfirmingRazorpay(false);
    }
  }

  function handleExcludeRazorpayRider(phone: string) {
    setRazorpayPreview((current) =>
      current ? { ...current, newRiders: current.newRiders.filter((r) => r.phone !== phone) } : current,
    );
  }

  function stravaLinkCandidatesSection() {
    if (stravaLinkCandidates.length === 0) return null;
    return (
      <Alert variant="primary">
        <p className="fw-semibold mb-2">
          {stravaLinkCandidates.length} already-registered rider{stravaLinkCandidates.length === 1 ? "" : "s"}{" "}
          connected Strava after registering — confirm to link {stravaLinkCandidates.length === 1 ? "it" : "them"} to
          their registration.
        </p>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          <Table size="sm" bordered className="mb-3 bg-white">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Strava Athlete Id</th>
              </tr>
            </thead>
            <tbody>
              {stravaLinkCandidates.map((rider) => (
                <tr key={rider.phone} className="table-primary">
                  <td>{rider.full_name || "—"}</td>
                  <td>{rider.phone}</td>
                  <td>
                    <a
                      href={`https://www.strava.com/athletes/${rider.matchedAthleteId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {rider.matchedAthleteId}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="d-flex gap-2">
          <Button size="sm" onClick={handleConfirmStravaLinks} disabled={linking}>
            {linking ? "Linking…" : `Confirm and link ${stravaLinkCandidates.length}`}
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={handleCancelStravaLinks} disabled={linking}>
            Cancel
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div>
      {!sheetName && !hasRazorpayPaymentLink && (
        <Alert variant="warning" className="mb-0">
          This event has no registration sheet (<code>registeredGoogleDataXLS</code>) and no Razorpay payment link
          configured — nothing to sync from.
        </Alert>
      )}

      {/* Google Sheet sync is retired in favor of the direct-Razorpay path
          below once an event has a payment_link — it only remains as a
          fallback for an event that doesn't (e.g. one that predates
          Razorpay integration, or never got a payment link configured). */}
      {!hasRazorpayPaymentLink && sheetName && (
        <div>
          <p className="text-muted mb-3">
            Reads the <code>{sheetName}</code> tab of the shared registrations spreadsheet and shows any new riders
            not already registered for this event, plus any already-registered rider who&apos;s connected Strava
            since — nobody already registered is changed or removed otherwise, including any manual corrections made
            from the table below.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          {addedCount !== null && (
            <Alert variant="success">
              Added {addedCount} new rider{addedCount === 1 ? "" : "s"} to this event.
            </Alert>
          )}

          {linkedCount !== null && (
            <Alert variant="success">
              Linked {linkedCount} rider{linkedCount === 1 ? "" : "s"} to their Strava account.
            </Alert>
          )}

          {preview && preview.newRiders.length === 0 && preview.stravaLinkCandidates.length === 0 && (
            <Alert variant="info">No new users — all riders are already registered and linked to Strava.</Alert>
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
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {preview.newRiders.map((rider) => (
                      <tr key={rider.phone} className="table-warning">
                        <td>{rider.full_name || "—"}</td>
                        <td>{rider.phone}</td>
                        <td>{rider.city || "—"}</td>
                        <td>{rider.state || "—"}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleExcludeNewRider(rider.phone)}
                            disabled={confirming}
                            title="Don't add this one — remove it from the list before confirming"
                          >
                            <i className="bi bi-trash3" aria-hidden />
                          </Button>
                        </td>
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

          {stravaLinkCandidatesSection()}

          <Button onClick={handleCheck} disabled={checking}>
            {checking ? "Checking…" : "Check for new registrations"}
          </Button>
        </div>
      )}

      {hasRazorpayPaymentLink && (
        <div>
          <p className="text-muted mb-3">
            Reads captured payments directly from Razorpay&apos;s API — no manual Excel export or Google Sheet
            update needed — and shows any new riders not already registered for this event.
          </p>

          {razorpayError && <Alert variant="danger">{razorpayError}</Alert>}

          {razorpayAddedCount !== null && (
            <Alert variant="success">
              Added {razorpayAddedCount} new rider{razorpayAddedCount === 1 ? "" : "s"} to this event.
            </Alert>
          )}

          {linkedCount !== null && (
            <Alert variant="success">
              Linked {linkedCount} rider{linkedCount === 1 ? "" : "s"} to their Strava account.
            </Alert>
          )}

          {razorpayPreview &&
            razorpayPreview.newRiders.length === 0 &&
            razorpayPreview.stravaLinkCandidates.length === 0 && (
              <Alert variant="info">No new users — all captured Razorpay payments are already registered.</Alert>
            )}

          {razorpayPreview && razorpayPreview.newRiders.length > 0 && (
            <Alert variant="warning">
              <p className="fw-semibold mb-2">
                {razorpayPreview.newRiders.length} new rider{razorpayPreview.newRiders.length === 1 ? "" : "s"} found
                via Razorpay — confirm to add {razorpayPreview.newRiders.length === 1 ? "it" : "them"} to this event.
              </p>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <Table size="sm" bordered className="mb-3 bg-white">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>City</th>
                      <th>State</th>
                      <th>Strava</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {razorpayPreview.newRiders.map((rider) => (
                      <tr key={rider.phone} className="table-warning">
                        <td>{rider.full_name || "—"}</td>
                        <td>{rider.phone}</td>
                        <td>{rider.city || "—"}</td>
                        <td>{rider.state || "—"}</td>
                        <td>
                          {rider.stravaId ? (
                            <a
                              href={`https://www.strava.com/athletes/${rider.stravaId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {rider.stravaId}
                            </a>
                          ) : (
                            <span className="text-muted">Not connected</span>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleExcludeRazorpayRider(rider.phone)}
                            disabled={confirmingRazorpay}
                            title="Don't add this one — remove it from the list before confirming"
                          >
                            <i className="bi bi-trash3" aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="d-flex gap-2">
                <Button size="sm" onClick={handleConfirmRazorpay} disabled={confirmingRazorpay}>
                  {confirmingRazorpay ? "Adding…" : `Confirm and add ${razorpayPreview.newRiders.length}`}
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setRazorpayPreview(null)}
                  disabled={confirmingRazorpay}
                >
                  Cancel
                </Button>
              </div>
            </Alert>
          )}

          {stravaLinkCandidatesSection()}

          <Button onClick={handleCheckRazorpay} disabled={checkingRazorpay}>
            {checkingRazorpay ? "Checking…" : "Check Razorpay for new registrations"}
          </Button>
        </div>
      )}
    </div>
  );
}
