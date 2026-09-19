"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import AuthPageLayout from "./AuthPageLayout";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // This page is also the project's one Firebase Auth email action
    // handler (see docs/DEPLOY.md's Auth section — the project-wide Action
    // URL points here so password reset emails open our own styled page
    // instead of Firebase's generic hosted one). Only mode=resetPassword is
    // actually built out; hand any other mode (email verification, etc. —
    // unused today, but the handler still has to cover them) back to
    // Firebase's own hosted widget rather than failing here.
    if (mode && mode !== "resetPassword") {
      const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
      window.location.replace(`https://${authDomain}/__/auth/action?${searchParams.toString()}`);
    }
  }, [mode, searchParams]);

  useEffect(() => {
    if (!oobCode) {
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(setEmail)
      .catch(() => setError("This reset link is invalid or has expired."));
  }, [oobCode]);

  if (mode && mode !== "resetPassword") {
    return null;
  }

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
      <AuthPageLayout
        eyebrow="Reset password"
        heading="Password updated"
        subtitle="Your password has been reset successfully."
      >
        <Link href="/login" className="btn btn-success w-100">
          Log in
        </Link>
      </AuthPageLayout>
    );
  }

  if (invalidLink) {
    return (
      <AuthPageLayout
        eyebrow="Reset password"
        heading="Invalid link"
        subtitle={error ?? "This reset link is invalid or has expired."}
      >
        <Link href="/forgot-password" className="btn btn-success w-100">
          Request a new link
        </Link>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      eyebrow="Reset password"
      heading="Set a new password"
      subtitle={email ? `Resetting password for ${email}` : "Enter a new password for your account."}
    >
      <Form onSubmit={handleSubmit}>
        <PasswordInput
          label="New password"
          value={password}
          onChange={setPassword}
          minLength={6}
          required
          disabled={!email}
          icon="bi-lock"
        />
        <Button type="submit" variant="success" className="w-100" disabled={pending || !email}>
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </Form>
    </AuthPageLayout>
  );
}
