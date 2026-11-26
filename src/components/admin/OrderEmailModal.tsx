"use client";

import { useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import Table from "react-bootstrap/Table";
import { emailEventLook, resendableEmails, type EmailEvent, type ResendableEmail } from "@/lib/models/email-activity";
import type { ShopOrder } from "@/lib/models/order";

const LABELS: Record<ResendableEmail, string> = {
  confirmation: "order confirmation",
  shipment: "shipping details",
  cancellation: "cancellation notice",
};

export default function OrderEmailModal({
  order,
  events,
  statusNote,
  refreshing,
  onRefresh,
  onClose,
}: {
  order: ShopOrder | null;
  events: EmailEvent[];
  /** Why there's no delivery data (not set up, Brevo down, loading); null when there is. */
  statusNote: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<ResendableEmail | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const types = order ? resendableEmails(order) : [];

  async function resend(type: ResendableEmail) {
    if (!order || !confirm(`Send the ${LABELS[type]} again to ${order.shipTo.email}?`)) return;
    setError(null);
    setSent(null);
    setPending(type);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't send the email");
      setSent(`Sent the ${LABELS[type]} to ${body.to}. Its delivery status can take a minute to show — use Refresh.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the email");
    } finally {
      setPending(null);
    }
  }

  return (
    <Modal show={order !== null} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Emails — {order?.orderNumber}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          Buyer: <strong>{order?.shipTo.email || "no email on this order"}</strong>
        </p>
        {types.length > 0 && order?.shipTo.email ? (
          <div className="d-flex flex-wrap gap-2 mb-2">
            {types.map((type) => (
              <Button key={type} size="sm" variant="success" disabled={pending !== null} onClick={() => resend(type)}>
                {pending === type ? "Sending…" : `Resend ${LABELS[type]}`}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-muted small">There&apos;s no email to resend for this order.</p>
        )}
        {sent && <p className="text-success small">{sent}</p>}
        {error && <p className="text-danger small">{error}</p>}

        <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
          <h2 className="h6 mb-0">Email delivery</h2>
          <Button size="sm" variant="outline-secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {statusNote ? (
          <p className="text-muted small mb-0">{statusNote}</p>
        ) : events.length === 0 ? (
          <p className="text-muted small mb-0">Brevo has no emails for this order in the last 90 days.</p>
        ) : (
          <Table responsive size="sm" className="small align-middle mb-0">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Subject</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {[...events]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((event, index) => {
                  const look = emailEventLook(event.event);
                  return (
                    <tr key={index}>
                      <td>
                        <Badge bg={look.variant}>{look.label}</Badge>
                        {event.reason && <div className="text-danger">{event.reason}</div>}
                      </td>
                      <td className="text-nowrap">
                        {new Date(event.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                      </td>
                      <td>{event.subject}</td>
                      <td>{event.to}</td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        )}
      </Modal.Body>
    </Modal>
  );
}
