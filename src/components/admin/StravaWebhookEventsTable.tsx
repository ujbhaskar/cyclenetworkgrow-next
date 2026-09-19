"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import type { StravaWebhookEventRow } from "@/lib/strava-webhook-events";

const LOAD_MORE_SIZE = 100;

const ASPECT_BADGE_VARIANT: Record<string, string> = {
  create: "success",
  update: "secondary",
  delete: "danger",
};

export default function StravaWebhookEventsTable({
  initialEvents,
  initialCursor,
}: {
  initialEvents: StravaWebhookEventRow[];
  initialCursor: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor, limit: String(LOAD_MORE_SIZE) });
      const res = await fetch(`/api/admin/strava-webhook-events?${params}`);
      if (!res.ok) {
        throw new Error("Failed to load more events");
      }
      const page: { events: StravaWebhookEventRow[]; nextCursor: string | null } = await res.json();
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more events");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <Table striped bordered hover size="sm" className="text-center align-middle">
          <thead>
            <tr>
              <th>Received</th>
              <th>Aspect</th>
              <th>Object type</th>
              <th>Activity / Object ID</th>
              <th>Athlete (owner) ID</th>
              <th>Subscription</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="text-nowrap">{new Date(event.receivedAt).toLocaleString()}</td>
                <td>
                  {event.aspectType ? (
                    <Badge bg={ASPECT_BADGE_VARIANT[event.aspectType] ?? "secondary"}>{event.aspectType}</Badge>
                  ) : (
                    "–"
                  )}
                </td>
                <td>{event.objectType ?? "–"}</td>
                <td>
                  {event.objectId && event.objectType === "activity" ? (
                    <a href={`https://www.strava.com/activities/${event.objectId}`} target="_blank" rel="noopener noreferrer">
                      {event.objectId}
                    </a>
                  ) : (
                    (event.objectId ?? "–")
                  )}
                </td>
                <td>
                  {event.ownerId ? (
                    <a href={`https://www.strava.com/athletes/${event.ownerId}`} target="_blank" rel="noopener noreferrer">
                      {event.ownerId}
                    </a>
                  ) : (
                    "–"
                  )}
                </td>
                <td>{event.subscriptionId ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {events.length === 0 && <p className="text-muted">No webhook events recorded (yet).</p>}

      <div className="text-center text-muted small mb-3">Showing {events.length} events</div>

      {error && <p className="text-danger small text-center">{error}</p>}

      {cursor && (
        <div className="text-center">
          <Button variant="outline-secondary" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
