"use client";

import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { auth } from "@/lib/firebase/client";

// Phone-based reset is intentionally not wired up here yet: now that email
// is the sole login credential (see docs/ARCHITECTURE.md §4), resetting via
// phone OTP needs the same phone→email resolution LoginForm uses
// (/api/auth/resolve-identifier) rather than the old "phone-linked
// credential" assumption — pending a decision on that design. The server
// route from that earlier design (/api/auth/reset-password-phone) is still
// in place and ready to be reconnected once decided.

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function handleSendResetEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      setEmailSent(true);
    } catch {
      // Don't reveal whether the email exists — show the same message either way.
      setEmailSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="py-3" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-4">Reset your password</h1>

      {!emailSent ? (
        <Form onSubmit={handleSendResetEmail}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>
          {error && <p className="text-danger small">{error}</p>}
          <Button type="submit" className="w-100" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </Form>
      ) : (
        <p className="text-muted">
          If an account exists for that email, a reset link has been sent. Check your inbox.
        </p>
      )}
    </Container>
  );
}
