"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import { establishSession } from "@/lib/auth/establish-session";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/auth/phone";
import { INDIAN_STATES_AND_UTS } from "@/lib/models/india-states";
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
        profile: {
          firstName,
          lastName,
          address: address || undefined,
          phone: fullPhone,
          city: city || undefined,
          state: state || undefined,
          pincode: pincode || undefined,
        },
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
    <>
      <Form onSubmit={handleSubmit}>
        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <Form.Group>
              <Form.Label>First name</Form.Label>
              <Form.Control value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </Form.Group>
          </div>
          <div className="col-sm-6">
            <Form.Group>
              <Form.Label>Last name</Form.Label>
              <Form.Control value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </Form.Group>
          </div>
        </div>

        <Form.Group className="mb-3">
          <Form.Label>Email address</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-envelope" aria-hidden />
            </InputGroup.Text>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rider@letscng.com"
              required
            />
          </InputGroup>
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

        <PasswordInput value={password} onChange={setPassword} minLength={6} required icon="bi-lock" />

        <Form.Group className="mb-3">
          <Form.Label>Address</Form.Label>
          <Form.Control value={address} onChange={(e) => setAddress(e.target.value)} required />
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
        <Button
          type="submit"
          variant="success"
          className="w-100 d-flex align-items-center justify-content-center gap-2"
          disabled={pending}
        >
          {pending ? "Creating account…" : "Create account"}
          {!pending && <i className="bi bi-arrow-right" aria-hidden />}
        </Button>
      </Form>

      <p className="text-center small mt-4 mb-0">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
