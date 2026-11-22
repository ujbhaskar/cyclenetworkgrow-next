"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import type { OrderShipTo, ShopOrder } from "@/lib/models/order";

// Corrects an order's delivery details only — the rider's own profile is
// untouched. Remounted per order (see the `key` in OrdersTable) so the
// useState seeds below never go stale.
export default function OrderAddressModal({
  order,
  onClose,
  onSaved,
}: {
  /** The order being edited — modal is shown whenever this is non-null. */
  order: ShopOrder | null;
  onClose: () => void;
  onSaved: (orderId: string, shipTo: OrderShipTo) => void;
}) {
  const [form, setForm] = useState<OrderShipTo>(
    order?.shipTo ?? { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof OrderShipTo, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipTo: form }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't save the address");
      onSaved(order.id, body.shipTo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the address");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={order !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit delivery details — {order?.orderNumber}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <p className="text-muted small">Changes this order only, not the rider&apos;s profile. The rider sees the update on their order page.</p>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Form.Group>
          <Row>
            <Col sm={6}>
              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10 digits" />
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>Address</Form.Label>
            <Form.Control as="textarea" rows={3} value={form.address} onChange={(e) => set("address", e.target.value)} required />
          </Form.Group>
          <Row>
            <Col sm={5}>
              <Form.Group className="mb-3">
                <Form.Label>City</Form.Label>
                <Form.Control value={form.city} onChange={(e) => set("city", e.target.value)} required />
              </Form.Group>
            </Col>
            <Col sm={7}>
              <Form.Group className="mb-3">
                <Form.Label>State</Form.Label>
                <Form.Select value={form.state} onChange={(e) => set("state", e.target.value)} required>
                  <option value="">— Select —</option>
                  {INDIAN_STATES_AND_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3" style={{ maxWidth: 200 }}>
            <Form.Label>Pincode</Form.Label>
            <Form.Control value={form.pincode} onChange={(e) => set("pincode", e.target.value)} inputMode="numeric" maxLength={6} required />
          </Form.Group>

          {error && <p className="text-danger small">{error}</p>}
          <div className="d-flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline-secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
