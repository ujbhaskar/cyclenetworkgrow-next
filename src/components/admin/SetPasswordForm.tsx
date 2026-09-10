"use client";

import { useState, type FormEvent } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";

type Result = { uid: string; created: boolean; password: string };

export default function SetPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: password || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      setResult(await res.json());
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 className="h3 mb-3">Set/Reset User Password</h1>
      <p className="text-muted small">
        For users without easy internet access — set a password here and relay it to them
        offline (phone call, in person). Leave the password field blank to auto-generate one.
      </p>

      <Form onSubmit={handleSubmit} className="mb-4">
        <Form.Group className="mb-3">
          <Form.Label>User&apos;s email or phone number</Form.Label>
          <Form.Control
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or +91 98765 43210"
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>New password (optional — auto-generated if blank)</Form.Label>
          <Form.Control value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
        </Form.Group>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </Button>
      </Form>

      {error && <Alert variant="danger">{error}</Alert>}

      {result && (
        <Alert variant="success">
          <p className="mb-1">
            {result.created ? "Account created." : "Password updated."} Relay this password to the
            rider — it won&apos;t be shown again:
          </p>
          <code className="fs-5">{result.password}</code>
        </Alert>
      )}
    </div>
  );
}
