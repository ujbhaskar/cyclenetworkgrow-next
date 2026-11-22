"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import type { OrderShipment, ShopOrder } from "@/lib/models/order";

// Suggestions only — any courier name can be typed.
const COURIER_SUGGESTIONS = ["India Post", "DTDC", "Delhivery", "Blue Dart", "Professional Couriers", "Ecom Express", "XpressBees"];

export default function ShipmentModal({
  order,
  onClose,
  onSaved,
}: {
  /** The order being shipped — modal is shown whenever this is non-null. */
  order: ShopOrder | null;
  onClose: () => void;
  onSaved: (orderId: string, shipment: OrderShipment | null) => void;
}) {
  const existing = order?.shipment ?? null;
  const [courier, setCourier] = useState(existing?.courier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(existing?.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(existing?.trackingUrl ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courier, trackingNumber, trackingUrl, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't save the courier details");
      onSaved(order.id, body.shipment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the courier details");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    if (!order || !confirm("Remove the courier details from this order?")) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipment`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove the courier details");
      onSaved(order.id, null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the courier details");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={order !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Courier details — {order?.orderNumber}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <p className="text-muted small">
            {order?.shipTo.name} · {order?.items.map((i) => `${i.qty} × ${i.productTitle}`).join(", ")}. The rider sees this on their order page.
          </p>
          <Form.Group className="mb-3">
            <Form.Label>Courier</Form.Label>
            <Form.Control
              list="courier-suggestions"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. DTDC"
              required
            />
            <datalist id="courier-suggestions">
              {COURIER_SUGGESTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Tracking number / AWB</Form.Label>
            <Form.Control value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Tracking link (optional)</Form.Label>
            <Form.Control
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://… the courier's tracking page"
            />
            <Form.Text className="text-muted">
              Paste the courier&apos;s tracking page (with the number filled in if it supports that). Riders get a
              &quot;Track shipment&quot; button.
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Note for the rider (optional)</Form.Label>
            <Form.Control value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Expected by 28 Nov" />
          </Form.Group>

          {error && <p className="text-danger small">{error}</p>}
          <div className="d-flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : existing ? "Update" : "Save"}
            </Button>
            {existing && (
              <Button type="button" variant="outline-danger" disabled={pending} onClick={handleRemove}>
                Remove
              </Button>
            )}
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
