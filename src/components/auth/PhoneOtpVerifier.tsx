"use client";

import { useRef, useState, type FormEvent } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult, type User } from "firebase/auth";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import { auth } from "@/lib/firebase/client";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/auth/phone";

export default function PhoneOtpVerifier({ onVerified }: { onVerified: (user: User) => void }) {
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const fullPhoneNumber = `${countryCode}${phone.replace(/\D/g, "")}`;

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!recaptchaContainerRef.current) return;
    setError(null);
    setPending(true);
    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: "invisible",
      });
      const result = await signInWithPhoneNumber(auth, fullPhoneNumber, verifier);
      setConfirmation(result);
    } catch {
      setError("Could not send a code. Check the phone number and try again.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setError(null);
    setPending(true);
    try {
      const credential = await confirmation.confirm(code);
      onVerified(credential.user);
    } catch {
      setError("Incorrect code. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!confirmation) {
    return (
      <Form onSubmit={sendCode}>
        <Form.Group className="mb-3">
          <Form.Label>Phone number</Form.Label>
          <InputGroup>
            <Form.Select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{ maxWidth: 140 }}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Form.Select>
            <Form.Control
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="98765 43210"
              pattern="[0-9]{10}"
              maxLength={10}
              required
            />
          </InputGroup>
        </Form.Group>
        <div ref={recaptchaContainerRef} />
        {error && <p className="text-danger small">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send code"}
        </Button>
      </Form>
    );
  }

  return (
    <Form onSubmit={verifyCode}>
      <Form.Group className="mb-3">
        <Form.Label>Enter the code sent to {fullPhoneNumber}</Form.Label>
        <Form.Control
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </Form.Group>
      {error && <p className="text-danger small">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </Form>
  );
}
