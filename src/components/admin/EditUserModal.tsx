"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import type { UserProfile } from "@/lib/models/user";

// Riders often typo their name/city/state at signup, or Strava's
// free-text profile fields carry the mistake through — and aren't always
// comfortable finding My Profile themselves to fix it. This lets an admin
// correct it directly from the Users list. Deliberately no email/password
// field here — those go through Set User Password / the user's own
// sign-in, not this quick-fix modal.
export default function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  /** The user being edited — modal is shown whenever this is non-null. */
  user: UserProfile | null;
  onClose: () => void;
  onSaved: (updated: Partial<UserProfile> & { uid: string }) => void;
}) {
  // Seeded straight from the `user` prop — the parent remounts this
  // component (via a `key` tied to the user's uid) whenever a different
  // user is opened for editing, so plain useState initializers are enough;
  // no effect needed to "re-seed" on prop change.
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [state, setState] = useState(user?.state ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, city, state, phone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save changes");
      }
      const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || user.displayName;
      onSaved({
        uid: user.uid,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        phone: phone.trim() || null,
        displayName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={user !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit {user?.displayName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>First name</Form.Label>
            <Form.Control value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Last name</Form.Label>
            <Form.Control value={lastName} onChange={(e) => setLastName(e.target.value)} />
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
