"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import { establishSession } from "@/lib/auth/establish-session";
import { looksLikeEmail } from "@/lib/auth/phone";
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
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const email = await resolveToEmail(identifier);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const { stravaConnected } = await establishSession(credential.user, { rememberMe });
      // Nudge riders who haven't connected Strava yet straight to the
      // profile page to do it, instead of the home page — everyone else
      // goes wherever they were headed as normal.
      router.push(stravaConnected ? redirectTo : "/profile");
      router.refresh();
    } catch (err) {
      const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
      setError(friendlyError(code));
      setPending(false);
    }
  }

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Email or phone number</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-person" aria-hidden />
            </InputGroup.Text>
            <Form.Control
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="rider@letscng.com or 98765 43210"
              required
            />
          </InputGroup>
          <Form.Text className="text-muted">10-digit phone number, no country code needed.</Form.Text>
        </Form.Group>
        <PasswordInput value={password} onChange={setPassword} required icon="bi-lock" />

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <Form.Check
            type="checkbox"
            id="remember-me"
            label="Remember me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <Link href="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-danger small">{error}</p>}
        <Button
          type="submit"
          variant="success"
          className="w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
          disabled={pending}
        >
          {pending ? "Logging in…" : "Login"}
          {!pending && <i className="bi bi-arrow-right" aria-hidden />}
        </Button>
      </Form>

      <p className="text-center small mt-4 mb-0">
        Don&apos;t have an account? <Link href="/signup">Sign up</Link>
      </p>
    </>
  );
}
