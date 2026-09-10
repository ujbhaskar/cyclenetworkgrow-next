"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { EVENT_DIFFICULTIES, EVENT_STATUSES, type EventDifficulty, type EventStatus } from "@/lib/models/event";

export default function CreateEventModal({
  show,
  onClose,
  onCreated,
}: {
  show: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Road");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [difficulty, setDifficulty] = useState<EventDifficulty>("Beginner");
  const [status, setStatus] = useState<EventStatus>("draft");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setCategory("Road");
    setStartDate("");
    setEndDate("");
    setLocation("");
    setDistanceKm("");
    setDifficulty("Beginner");
    setStatus("draft");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          category,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          location,
          distanceKm: Number(distanceKm),
          difficulty,
          status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't create event");
      }
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create event");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Add event</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control as="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Group>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Start date</Form.Label>
                <Form.Control type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>End date</Form.Label>
                <Form.Control type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Location</Form.Label>
                <Form.Control value={location} onChange={(e) => setLocation(e.target.value)} required />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Distance (km)</Form.Label>
                <Form.Control type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} required />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Control value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Road, MTB, Gravel…" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Difficulty</Form.Label>
                <Form.Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as EventDifficulty)}>
                  {EVENT_DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">Only &quot;active&quot; events show on the home page.</Form.Text>
              </Form.Group>
            </Col>
          </Row>
          {error && <p className="text-danger small">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create event"}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
