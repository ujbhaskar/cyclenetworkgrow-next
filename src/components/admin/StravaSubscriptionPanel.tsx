"use client";

import { useState } from "react";
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

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="d-flex align-items-center gap-3 mb-4">
        <i className={`bi bi-plug-fill fs-1 ${subscription ? "text-success" : "text-secondary"}`} aria-hidden />
        <i className={`bi bi-strava fs-1 ${subscription ? "text-danger" : "text-secondary"}`} aria-hidden />
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
