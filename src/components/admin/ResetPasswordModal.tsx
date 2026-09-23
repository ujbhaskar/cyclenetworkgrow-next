"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import type { UserProfile } from "@/lib/models/user";

// Confirmation lives in the act of typing/submitting this modal — no
// separate window.confirm() needed. Password field is optional: leaving it
// blank falls back to a randomly generated one (see resetUserPasswordByUid).
export default function ResetPasswordModal({
  user,
  onClose,
  onReset,
}: {
  /** The user being reset — modal is shown whenever this is non-null. */
  user: UserProfile | null;
  onClose: () => void;
  onReset: (result: { name: string; password: string }) => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (password && password.length < 6) {
      setError("Password must be at least 6 characters, or left blank to generate one.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't reset that user's password.");
      }
      onReset({ name: user.displayName, password: body.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset that user's password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={user !== null} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Reset password for {user?.displayName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>New password</Form.Label>
            <Form.Control
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to generate one automatically"
              autoFocus
            />
            <Form.Text className="text-muted">At least 6 characters, or leave blank to generate one.</Form.Text>
          </Form.Group>
          {error && <p className="text-danger small">{error}</p>}
          <div className="d-flex gap-2">
            <Button type="submit" variant="warning" disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
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
