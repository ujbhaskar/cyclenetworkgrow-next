"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import type { EventRider } from "@/lib/events";

// Same typo-fixing purpose as EditUserModal, for the registration-sync
// list specifically — a rider here may not even have a My Profile account
// (registration-only, never signed up), so this is often the *only* way
// to fix their details short of re-editing the shared Google Sheet.
export default function EditEventRiderModal({
  eventId,
  rider,
  onClose,
  onSaved,
}: {
  eventId: string;
  /** The rider being edited — modal is shown whenever this is non-null. */
  rider: EventRider | null;
  onClose: () => void;
  onSaved: (previousPhone: string, updated: EventRider) => void;
}) {
  // Seeded from the `rider` prop — the parent remounts this component (via
  // a `key` tied to the rider's phone) whenever a different rider is
  // opened for editing.
  const [fullName, setFullName] = useState(rider?.full_name ?? "");
  const [city, setCity] = useState(rider?.city ?? "");
  const [state, setState] = useState(rider?.state ?? "");
  const [phone, setPhone] = useState(rider?.phone ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rider) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/legacy-events/${eventId}/riders/${rider.phone}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, city, state, phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't save changes");
      }
      onSaved(rider.phone, body.rider as EventRider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={rider !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit {rider?.full_name || "rider"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Ride history for this rider stays filed under their phone
            number at the time each ride synced — changing phone here
            doesn't move it. See updateEventRiderByAdmin. */}
        <p className="text-muted small">
          Note: if you change the phone number, any rides already synced under the old number stay there — this
          only fixes the registration record shown here.
        </p>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Full name</Form.Label>
            <Form.Control value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Phone</Form.Label>
            <Form.Control value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>City</Form.Label>
            <Form.Control value={city} onChange={(e) => setCity(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>State</Form.Label>
            <Form.Select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">— Select —</option>
              {INDIAN_STATES_AND_UTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Form.Select>
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
