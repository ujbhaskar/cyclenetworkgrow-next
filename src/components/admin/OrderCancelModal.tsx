"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { formatPrice } from "@/lib/models/product";
import type { ShopOrder } from "@/lib/models/order";

export default function OrderCancelModal({
  order,
  onClose,
  onCancelled,
}: {
  /** The order being cancelled — modal is shown whenever this is non-null. */
  order: ShopOrder | null;
  onClose: () => void;
  onCancelled: (orderId: string, change: Partial<ShopOrder>) => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = order?.status === "paid";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't cancel the order");
      onCancelled(order.id, { status: "cancelled", cancelReason: body.cancelReason ?? null, cancelledAt: body.cancelledAt ?? null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel the order");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={order !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Cancel order {order?.orderNumber}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {paid ? (
            <Alert variant="warning">
              This order is <strong>paid</strong> ({order ? formatPrice(order.amount) : ""}). Cancelling it does{" "}
              <strong>not</strong> refund the rider — refund the payment{" "}
              <code>{order?.razorpayPaymentId}</code> in the Razorpay dashboard yourself.
            </Alert>
          ) : (
            <p className="text-muted small">
              This order hasn&apos;t been paid. Its payment link will be closed so it can&apos;t be paid afterwards.
            </p>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Reason (optional)</Form.Label>
            <Form.Control
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Out of stock"
              maxLength={200}
              autoFocus
            />
            <Form.Text className="text-muted">
              The rider is emailed that the order was cancelled, and sees this reason. Admins get a copy.
            </Form.Text>
          </Form.Group>
          {error && <p className="text-danger small">{error}</p>}
          <div className="d-flex gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Cancelling…" : "Cancel order"}
            </Button>
            <Button type="button" variant="outline-secondary" onClick={onClose} disabled={pending}>
              Keep order
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
