"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import type { OrderFlag, ShopOrder } from "@/lib/models/order";

// Flags are private to admins — the rider never sees them.
export default function OrderFlagModal({
  order,
  onClose,
  onSaved,
}: {
  order: ShopOrder | null;
  onClose: () => void;
  onSaved: (orderId: string, flag: OrderFlag | null) => void;
}) {
  const [reason, setReason] = useState(order?.flag?.reason ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    if (!order) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: next === null ? null : { reason: next } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't save the flag");
      onSaved(order.id, body.flag ?? null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the flag");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save(reason);
  }

  return (
    <Modal show={order !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>{order?.flag ? "Edit flag" : "Flag order"} — {order?.orderNumber}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Reason</Form.Label>
            <Form.Control
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Address unclear — call the rider"
              maxLength={200}
              required
              autoFocus
            />
            <Form.Text className="text-muted">Only admins see this.</Form.Text>
          </Form.Group>
          {error && <p className="text-danger small">{error}</p>}
          <div className="d-flex gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Saving…" : order?.flag ? "Update flag" : "Flag order"}
            </Button>
            {order?.flag && (
              <Button type="button" variant="outline-secondary" disabled={pending} onClick={() => save(null)}>
                Clear flag
              </Button>
            )}
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
