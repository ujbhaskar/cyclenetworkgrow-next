"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import { establishSession } from "@/lib/auth/establish-session";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/auth/phone";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
import GoogleSignInButton from "./GoogleSignInButton";
import PasswordInput from "./PasswordInput";

export default function SignupForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fullPhone = `${countryCode}${phone}`;
      // Email is the sole login credential — Firebase only allows one
      // password-type credential per account, so the phone can't also be
      // linked as a second one (see docs/ARCHITECTURE.md §4). Phone is
      // stored as mandatory contact info only.
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await establishSession(credential.user, {
        firstName,
        lastName,
        address: address || undefined,
        phone: fullPhone,
        city: city || undefined,
        state: state || undefined,
        pincode: pincode || undefined,
      });
      router.push(redirectTo);
      router.refresh();
      // Deliberately don't reset `pending` here — leaving the button
      // disabled until the redirect completes avoids a double-submit if the
      // user clicks again in the moment before navigation finishes.
    } catch {
      setError("Couldn't create your account. That email may already be in use.");
      setPending(false);
    }
  }

  return (
    <Container className="py-3" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-4">Sign up</h1>

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>First name</Form.Label>
          <Form.Control value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Last name</Form.Label>
          <Form.Control value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Form.Group>

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

        <PasswordInput value={password} onChange={setPassword} minLength={6} required />

        <Form.Group className="mb-3">
          <Form.Label>Address (optional)</Form.Label>
          <Form.Control value={address} onChange={(e) => setAddress(e.target.value)} />
        </Form.Group>

        <div className="row g-3 mb-3">
          <div className="col-sm-5">
            <Form.Group>
              <Form.Label>City (optional)</Form.Label>
              <Form.Control value={city} onChange={(e) => setCity(e.target.value)} />
            </Form.Group>
          </div>
          <div className="col-sm-4">
            <Form.Group>
              <Form.Label>State (optional)</Form.Label>
              <Form.Select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Select…</option>
                {INDIAN_STATES_AND_UTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="col-sm-3">
            <Form.Group>
              <Form.Label>PIN code (optional)</Form.Label>
              <Form.Control
                inputMode="numeric"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="110001"
                pattern="[1-9][0-9]{5}"
                maxLength={6}
              />
            </Form.Group>
          </div>
        </div>

        {error && <p className="text-danger small">{error}</p>}
        <Button type="submit" className="w-100" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </Form>

      <div className="text-center text-muted small my-3">or</div>
      <GoogleSignInButton redirectTo={redirectTo} />

      <div className="text-center small mt-4">
        <Link href="/login">Already have an account? Log in</Link>
      </div>
    </Container>
  );
}
