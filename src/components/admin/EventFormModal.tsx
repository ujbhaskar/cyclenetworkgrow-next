"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { EVENT_CATEGORIES, EVENT_STATUSES, EVENT_TYPES, type EventInput } from "@/lib/models/event";

const EMPTY: EventInput = {
  name: "",
  description: "",
  image: "",
  startDate: "",
  endDate: "",
  registrationStartDate: "",
  registrationEndDate: "",
  path: "",
  category: "",
  publish: false,
  rules: "",
  payment_link: "",
  distance: "",
  minDistance: "",
  metrics: "",
  eventType: "",
  status: "",
  registeredGoogleDataXLS: "",
};

// Plain URL <-> base64 round trip, matching the legacy admin's own
// encodeUrl() helper for the `image`/`rules` fields.
function encodeUrl(url: string): string {
  return url ? btoa(url) : "";
}
function decodeUrl(encoded: string): string {
  if (!encoded) return "";
  try {
    return atob(encoded);
  } catch {
    return encoded;
  }
}

// Loose shape — whatever /api/admin/events/{id} returns.
type InitialEvent = Record<string, unknown> | null;

function formFromInitial(event: InitialEvent): EventInput {
  if (!event) {
    return EMPTY;
  }
  return {
    name: typeof event.name === "string" ? event.name : "",
    description: typeof event.description === "string" ? event.description : "",
    image: typeof event.image === "string" ? event.image : "",
    startDate: typeof event.startDate === "string" ? event.startDate : "",
    endDate: typeof event.endDate === "string" ? event.endDate : "",
    registrationStartDate: typeof event.registrationStartDate === "string" ? event.registrationStartDate : "",
    registrationEndDate: typeof event.registrationEndDate === "string" ? event.registrationEndDate : "",
    path: typeof event.path === "string" ? event.path : "",
    category: typeof event.category === "string" ? event.category : "",
    publish: Boolean(event.publish),
    rules: typeof event.rules === "string" ? event.rules : "",
    payment_link: typeof event.payment_link === "string" ? event.payment_link : "",
    distance: event.distance !== undefined && event.distance !== null ? String(event.distance) : "",
    minDistance: typeof event.minDistance === "string" ? event.minDistance : "",
    metrics: typeof event.metrics === "string" ? event.metrics : "",
    eventType: typeof event.eventType === "string" ? event.eventType : "",
    status: typeof event.status === "string" ? event.status : "",
    registeredGoogleDataXLS: typeof event.registeredGoogleDataXLS === "string" ? event.registeredGoogleDataXLS : "",
  };
}

export default function EventFormModal({
  show,
  eventId,
  initialEvent,
  onClose,
  onSaved,
}: {
  show: boolean;
  /** Editing an existing event when set; creating a new one when null. */
  eventId: string | null;
  /** Already-fetched detail for the event being edited — null when creating. */
  initialEvent: InitialEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Lazy initializers, not an effect — the parent remounts this component
  // (via `key`) each time it opens for a different target, and already has
  // the data (or knows there isn't any, for "new") before rendering it, so
  // there's nothing left to synchronize after mount.
  const [form, setForm] = useState<EventInput>(() => formFromInitial(initialEvent));
  const [imageUrlInput, setImageUrlInput] = useState(() => decodeUrl(typeof initialEvent?.image === "string" ? initialEvent.image : ""));
  const [rulesUrlInput, setRulesUrlInput] = useState(() => decodeUrl(typeof initialEvent?.rules === "string" ? initialEvent.rules : ""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload: EventInput = {
        ...form,
        image: encodeUrl(imageUrlInput),
        rules: encodeUrl(rulesUrlInput),
      };
      const res = await fetch(eventId ? `/api/admin/events/${eventId}` : "/api/admin/events", {
        method: eventId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save event");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save event");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{eventId ? "Edit event" : "Add event"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <p className="text-muted small">
            Core fields only — East Endurance medal-cutoff rules and online-event quota/point-system configuration
            aren&apos;t editable here yet; use the legacy admin panel for those until this form covers them too.
          </p>

            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Image URL</Form.Label>
                  <Form.Control value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Rules document URL</Form.Label>
                  <Form.Control value={rulesUrlInput} onChange={(e) => setRulesUrlInput(e.target.value)} />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Start date</Form.Label>
                  <Form.Control type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>End date</Form.Label>
                  <Form.Control type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} required />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Registration start date</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.registrationStartDate}
                    onChange={(e) => set("registrationStartDate", e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Registration end date</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.registrationEndDate}
                    onChange={(e) => set("registrationEndDate", e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Path (URL slug)</Form.Label>
                  <Form.Control value={form.path} onChange={(e) => set("path", e.target.value)} placeholder="e.g. aw80d-7.0" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Category</Form.Label>
                  <Form.Select value={form.category} onChange={(e) => set("category", e.target.value)} required>
                    <option value="">Select category</option>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Event type</Form.Label>
                  <Form.Select value={form.eventType} onChange={(e) => set("eventType", e.target.value)} required>
                    <option value="">Select type</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={form.status} onChange={(e) => set("status", e.target.value)} required>
                    <option value="">Select status</option>
                    {EVENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3 d-flex align-items-end h-100">
                  <Form.Check
                    type="checkbox"
                    label="Published"
                    checked={form.publish}
                    onChange={(e) => set("publish", e.target.checked)}
                  />
                </Form.Group>
              </Col>
            </Row>

            {form.eventType === "online" && (
              <Form.Group className="mb-3">
                <Form.Label>Registration Google Sheet tab name</Form.Label>
                <Form.Control
                  value={form.registeredGoogleDataXLS ?? ""}
                  onChange={(e) => set("registeredGoogleDataXLS", e.target.value)}
                  placeholder="e.g. 1177-6.0"
                />
              </Form.Group>
            )}

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Distance</Form.Label>
                  <Form.Control value={form.distance} onChange={(e) => set("distance", e.target.value)} placeholder="e.g. 40,075" />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Min distance</Form.Label>
                  <Form.Control value={form.minDistance} onChange={(e) => set("minDistance", e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Metrics</Form.Label>
                  <Form.Control value={form.metrics} onChange={(e) => set("metrics", e.target.value)} />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Payment link</Form.Label>
              <Form.Control value={form.payment_link} onChange={(e) => set("payment_link", e.target.value)} />
            </Form.Group>

          {error && <p className="text-danger small">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : eventId ? "Save changes" : "Create event"}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
