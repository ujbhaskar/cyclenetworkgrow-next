"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import { establishSession } from "@/lib/auth/establish-session";
import { looksLikeEmail } from "@/lib/auth/phone";
import GoogleSignInButton from "./GoogleSignInButton";
import PasswordInput from "./PasswordInput";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/not-found":
      return "That email/phone number or password isn't right.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Couldn't sign you in. Please try again.";
  }
}

async function resolveToEmail(identifier: string): Promise<string> {
  if (looksLikeEmail(identifier)) {
    return identifier;
  }
  // Email is the sole login credential (see docs/ARCHITECTURE.md §4) — a
  // typed phone number is resolved to its account's real email first.
  const res = await fetch("/api/auth/resolve-identifier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: identifier }),
  });
  if (!res.ok) {
    throw Object.assign(new Error("not found"), { code: "auth/not-found" });
  }
  const { email } = await res.json();
  return email;
}

export default function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const email = await resolveToEmail(identifier);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await establishSession(credential.user);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
      setError(friendlyError(code));
      setPending(false);
    }
  }

  return (
    <Container className="py-3" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-4">Log in</h1>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Email or phone number</Form.Label>
          <Form.Control
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or +91 98765 43210"
            required
          />
        </Form.Group>
        <PasswordInput value={password} onChange={setPassword} required />
        {error && <p className="text-danger small">{error}</p>}
        <Button type="submit" className="w-100 mb-3" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </Form>

      <div className="text-center text-muted small mb-3">or</div>
      <GoogleSignInButton redirectTo={redirectTo} />

      <div className="text-center small mt-4">
        <Link href="/forgot-password">Forgot password?</Link>
        <span className="mx-2">·</span>
        <Link href="/signup">Create an account</Link>
      </div>
    </Container>
  );
}
