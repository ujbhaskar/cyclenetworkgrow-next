"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import type { StravaSubscription } from "@/lib/strava";

export default function StravaSubscriptionPanel({
  initialSubscription,
}: {
  initialSubscription: StravaSubscription | null;
}) {
  const router = useRouter();
  const [subscription, setSubscription] = useState(initialSubscription);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (
      !confirm(
        "This points ALL Strava activity events (every connected rider, not just this app's) at this deployment's webhook. Strava allows only one subscription per Client ID — if the legacy app or anything else has one, it'll be replaced. Continue?"
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/strava/subscription", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setSubscription(body.subscription);
      router.refresh();
    } else {
      setError(body.error ?? "Couldn't create the subscription.");
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel the Strava push subscription? Real-time activity sync stops until a new one is created.")) {
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/strava/subscription", { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      setSubscription(null);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't cancel the subscription.");
    }
  }

  const boxStyle: CSSProperties = {
    width: 120,
    height: 90,
    borderColor: "#dee2e6",
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="d-flex align-items-center gap-3 mb-4">
        <div className="border rounded d-flex align-items-center justify-content-center p-2" style={boxStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element -- small local brand logo, no need for next/image here */}
          <img src="/logo.png" alt="Cycle Network Grow" style={{ maxWidth: "100%", maxHeight: "100%" }} />
        </div>
        <i
          className="bi bi-plug-fill fs-1"
          style={{ color: subscription ? "#198754" : "#adb5bd" }}
          aria-hidden
        />
        <div className="border rounded d-flex align-items-center justify-content-center" style={boxStyle}>
          <i
            className="bi bi-strava"
            style={{ fontSize: "2.5rem", color: subscription ? "#FC4C02" : "#adb5bd" }}
            aria-hidden
          />
        </div>
      </div>

      {subscription ? (
        <p className="text-muted">
          Subscription id: <span className="fw-semibold text-dark">{subscription.id}</span>
          <br />
          Callback URL: <code className="small">{subscription.callbackUrl}</code>
        </p>
      ) : (
        <p className="text-muted">No active subscription — no real-time Strava activity events are being received.</p>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {subscription ? (
        <Button variant="outline-danger" onClick={handleCancel} disabled={pending}>
          {pending ? "Cancelling…" : "Cancel Strava Subscription"}
        </Button>
      ) : (
        <Button variant="outline-primary" onClick={handleCreate} disabled={pending}>
          {pending ? "Enabling…" : "Enable Strava Subscription"}
        </Button>
      )}
    </div>
  );
}
