"use client";

import { useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { ROLES, type Role } from "@/lib/models/user";

export default function CreateUserModal({
  show,
  onClose,
  onCreated,
}: {
  show: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("rider");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ password: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password: password || undefined,
          role,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't create user");
      }
      const body = await res.json();
      setResult({ password: body.password });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create user");
    } finally {
      setPending(false);
    }
  }

  function handleClose() {
    setIdentifier("");
    setPassword("");
    setRole("rider");
    setFirstName("");
    setLastName("");
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Add user</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {result ? (
          <Alert variant="success">
            <p className="mb-1">Account created. Relay this password to the user — it won&apos;t be shown again:</p>
            <code className="fs-5">{result.password}</code>
          </Alert>
        ) : (
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email or phone number</Form.Label>
              <Form.Control value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>First name</Form.Label>
              <Form.Control value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Last name</Form.Label>
              <Form.Control value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password (optional — auto-generated if blank)</Form.Label>
              <Form.Control value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
            </Form.Group>
            {error && <p className="text-danger small">{error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
}
