"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(setEmail)
      .catch(() => setError("This reset link is invalid or has expired."));
  }, [oobCode]);

  const invalidLink = !oobCode || error;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!oobCode) return;
    setPending(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch {
      setError("Couldn't reset your password. Please request a new link.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Container className="py-3" style={{ maxWidth: 420 }}>
        <h1 className="h3 mb-3">Password updated</h1>
        <p className="text-muted">
          Your password has been reset. <Link href="/login">Log in</Link>.
        </p>
      </Container>
    );
  }

  if (invalidLink) {
    return (
      <Container className="py-3" style={{ maxWidth: 420 }}>
        <h1 className="h3 mb-3">Invalid link</h1>
        <p className="text-muted">
          {error ?? "This reset link is invalid or has expired."}{" "}
          <Link href="/forgot-password">Request a new one</Link>.
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-3" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-4">Set a new password</h1>
      {email && <p className="text-muted small">Resetting password for {email}</p>}
      <Form onSubmit={handleSubmit}>
        <PasswordInput
          label="New password"
          value={password}
          onChange={setPassword}
          minLength={6}
          required
          disabled={!email}
        />
        <Button type="submit" className="w-100" disabled={pending || !email}>
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </Form>
    </Container>
  );
}
