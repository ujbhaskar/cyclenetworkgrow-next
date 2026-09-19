"use client";

import { useState } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import type { RideRulesConfig } from "@/lib/models/ride-rules";

export default function RideRulesForm({ initialConfig }: { initialConfig: RideRulesConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof RideRulesConfig>(key: K, value: string) {
    setConfig((current) => ({ ...current, [key]: Number(value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    const res = await fetch("/api/admin/ride-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setPending(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't save these rules.");
    }
  }

  return (
    <Form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">Saved.</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Elapsed / moving time — max multiple</Form.Label>
        <Row className="align-items-center">
          <Col xs={4}>
            <Form.Control
              type="number"
              min={0}
              step="0.1"
              value={config.elapsedToMovingRatioMax}
              onChange={(e) => set("elapsedToMovingRatioMax", e.target.value)}
              required
            />
          </Col>
          <Col className="text-muted small">
            A ride&apos;s elapsed time can&apos;t exceed this many times its moving time (rules §7d) — used for the
            red highlight in Missing Rides and Ride Flagging.
          </Col>
        </Row>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Minimum ride distance</Form.Label>
        <Row className="align-items-center">
          <Col xs={4}>
            <Form.Control
              type="number"
              min={0}
              step="0.1"
              value={config.minRideDistanceKm}
              onChange={(e) => set("minRideDistanceKm", e.target.value)}
              required
            />
            <Form.Text className="text-muted">km</Form.Text>
          </Col>
          <Col className="text-muted small">
            Rides shorter than this don&apos;t qualify — used as the default minimum distance filter in Missing
            Rides.
          </Col>
        </Row>
      </Form.Group>

      <Form.Group className="mb-4">
        <Form.Label>Virtual ride — max distance allowed</Form.Label>
        <Row className="align-items-center">
          <Col xs={4}>
            <Form.Control
              type="number"
              min={0}
              step="0.1"
              value={config.maxVirtualRideDistanceKm}
              onChange={(e) => set("maxVirtualRideDistanceKm", e.target.value)}
              required
            />
            <Form.Text className="text-muted">km</Form.Text>
          </Col>
          <Col className="text-muted small">
            A single virtual/trainer ride longer than this is flagged for review in Missing Rides and Ride
            Flagging.
          </Col>
        </Row>
      </Form.Group>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rules"}
      </Button>
    </Form>
  );
}
