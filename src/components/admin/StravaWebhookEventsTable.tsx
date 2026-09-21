"use client";

import { useState, type FormEvent } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import type { StravaWebhookEventRow } from "@/lib/strava-webhook-events";

const PAGE_SIZE = 50;
const LOAD_MORE_SIZE = 100;

const ASPECT_BADGE_VARIANT: Record<string, string> = {
  create: "success",
  update: "secondary",
  delete: "danger",
};

const OUTCOME_BADGE_VARIANT: Record<string, string> = {
  accepted: "success",
  discarded: "warning",
  deleted: "info",
  not_participant: "secondary",
  ignored: "secondary",
  error: "danger",
};
const OUTCOME_LABEL: Record<string, string> = {
  accepted: "Accepted",
  discarded: "Discarded",
  deleted: "Deleted",
  not_participant: "Not a participant",
  ignored: "Ignored",
  error: "Error",
};
// Not tracked (no `outcome` field, e.g. events recorded before it was
// added) is its own filter option, not just an OUTCOME_LABEL fallback.
const NOT_TRACKED = "__not_tracked__";
const RESULT_FILTER_OPTIONS = [...Object.keys(OUTCOME_LABEL), NOT_TRACKED];

type Filters = { ownerId: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { ownerId: "", from: "", to: "" };

// datetime-local's value has no timezone — new Date(value) treats it as
// local time already, so this only needs to add seconds/exist-check, not
// any real conversion.
function toIso(datetimeLocalValue: string): string | undefined {
  if (!datetimeLocalValue) return undefined;
  const date = new Date(datetimeLocalValue);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

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
  const [formValues, setFormValues] = useState<Filters>(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState<Filters>(EMPTY_FILTERS);
  // Filtered client-side against whatever page(s) are already loaded,
  // unlike ownerId/from/to above — the Result column has few distinct
  // values and no Firestore index for it, so there's nothing to gain from
  // a server round trip, and it stays responsive to "Load more" too.
  const [resultFilter, setResultFilter] = useState("");

  async function fetchPage(filters: Filters, afterCursor: string | null, limit: number) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (afterCursor) params.set("cursor", afterCursor);
    if (filters.ownerId) params.set("ownerId", filters.ownerId.trim());
    const fromIso = toIso(filters.from);
    const toIsoValue = toIso(filters.to);
    if (fromIso) params.set("from", fromIso);
    if (toIsoValue) params.set("to", toIsoValue);

    const res = await fetch(`/api/admin/strava-webhook-events?${params}`);
    if (!res.ok) {
      throw new Error("Failed to load events");
    }
    return (await res.json()) as { events: StravaWebhookEventRow[]; nextCursor: string | null };
  }

  async function applyFilters(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(formValues, null, PAGE_SIZE);
      setEvents(page.events);
      setCursor(page.nextCursor);
      setActiveFilters(formValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  async function clearFilters() {
    setFormValues(EMPTY_FILTERS);
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(EMPTY_FILTERS, null, PAGE_SIZE);
      setEvents(page.events);
      setCursor(page.nextCursor);
      setActiveFilters(EMPTY_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(activeFilters, cursor, LOAD_MORE_SIZE);
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more events");
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilters = Boolean(activeFilters.ownerId || activeFilters.from || activeFilters.to);
  const visibleEvents = events.filter((event) => {
    if (!resultFilter) return true;
    if (resultFilter === NOT_TRACKED) return event.outcome === null;
    return event.outcome === resultFilter;
  });

  return (
    <div>
      <Form onSubmit={applyFilters} className="mb-4">
        <Row className="g-3 align-items-end">
          <Col xs={12} sm={6} md={3}>
            <Form.Label>Athlete (owner) ID</Form.Label>
            <Form.Control
              value={formValues.ownerId}
              onChange={(e) => setFormValues((v) => ({ ...v, ownerId: e.target.value }))}
              placeholder="e.g. 80181621"
              inputMode="numeric"
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Label>From</Form.Label>
            <Form.Control
              type="datetime-local"
              value={formValues.from}
              onChange={(e) => setFormValues((v) => ({ ...v, from: e.target.value }))}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Label>To</Form.Label>
            <Form.Control
              type="datetime-local"
              value={formValues.to}
              onChange={(e) => setFormValues((v) => ({ ...v, to: e.target.value }))}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Label>Result</Form.Label>
            <Form.Select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
              <option value="">All results</option>
              {RESULT_FILTER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === NOT_TRACKED ? "Not tracked" : OUTCOME_LABEL[value]}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={12} className="d-flex gap-2">
            <Button type="submit" disabled={loading}>
              Filter
            </Button>
            {hasActiveFilters && (
              <Button type="button" variant="outline-secondary" onClick={clearFilters} disabled={loading}>
                Clear
              </Button>
            )}
          </Col>
        </Row>
      </Form>

      <div style={{ overflowX: "auto" }}>
        <Table striped bordered hover size="sm" className="text-center align-middle">
          <thead>
            <tr>
              <th>Received</th>
              <th>Aspect</th>
              <th>Object type</th>
              <th>Activity / Object ID</th>
              <th>Athlete (owner) ID</th>
              <th>Rider</th>
              <th>Subscription</th>
              <th>Result</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((event) => (
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
                <td>{event.riderName ?? "–"}</td>
                <td>{event.subscriptionId ?? "–"}</td>
                <td>
                  {event.outcome ? (
                    <Badge bg={OUTCOME_BADGE_VARIANT[event.outcome] ?? "secondary"}>
                      {OUTCOME_LABEL[event.outcome] ?? event.outcome}
                    </Badge>
                  ) : (
                    <span className="text-muted">not tracked</span>
                  )}
                </td>
                <td className="text-start small text-muted" style={{ maxWidth: 280 }}>
                  {event.outcomeReason ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {visibleEvents.length === 0 && !loading && (
        <p className="text-muted">
          No webhook events {hasActiveFilters || resultFilter ? "match those filters" : "recorded (yet)"}.
        </p>
      )}

      <div className="text-center text-muted small mb-3">
        Showing {visibleEvents.length} of {events.length} loaded events
      </div>

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
