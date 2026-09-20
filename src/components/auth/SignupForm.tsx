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
import { PINCODE_PATTERN } from "@/lib/models/user";
import PasswordInput from "./PasswordInput";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export default function SignupForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f));
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!firstName.trim()) errors.firstName = "Enter your first name.";
    if (!lastName.trim()) errors.lastName = "Enter your last name.";
    if (!email.trim()) {
      errors.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "That email address isn't valid.";
    }
    if (!phone) {
      errors.phone = "Enter your phone number.";
    } else if (phone.length !== 10) {
      errors.phone = "Phone number must be 10 digits.";
    }
    if (!password) {
      errors.password = "Create a password.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    if (!address.trim()) errors.address = "Enter your address.";
    if (!city.trim()) errors.city = "Enter your city.";
    if (!state) errors.state = "Select your state.";
    if (!pincode) {
      errors.pincode = "Enter your PIN code.";
    } else if (!PINCODE_PATTERN.test(pincode)) {
      errors.pincode = "PIN code must be 6 digits.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) {
      return;
    }
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
          emergencyContactName: emergencyContactName || undefined,
          emergencyContactPhone: emergencyContactPhone || undefined,
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
      <Form onSubmit={handleSubmit} noValidate>
        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <Form.Group>
              <Form.Label>First name</Form.Label>
              <Form.Control
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearFieldError("firstName");
                }}
                isInvalid={Boolean(fieldErrors.firstName)}
              />
              <Form.Control.Feedback type="invalid">{fieldErrors.firstName}</Form.Control.Feedback>
            </Form.Group>
          </div>
          <div className="col-sm-6">
            <Form.Group>
              <Form.Label>Last name</Form.Label>
              <Form.Control
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearFieldError("lastName");
                }}
                isInvalid={Boolean(fieldErrors.lastName)}
              />
              <Form.Control.Feedback type="invalid">{fieldErrors.lastName}</Form.Control.Feedback>
            </Form.Group>
          </div>
        </div>

        <Form.Group className="mb-3">
          <Form.Label>Email address</Form.Label>
          <InputGroup hasValidation>
            <InputGroup.Text>
              <i className="bi bi-envelope" aria-hidden />
            </InputGroup.Text>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              placeholder="rider@letscng.com"
              isInvalid={Boolean(fieldErrors.email)}
            />
          </InputGroup>
          {fieldErrors.email && <div className="invalid-feedback d-block">{fieldErrors.email}</div>}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Phone number</Form.Label>
          <InputGroup hasValidation>
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
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                clearFieldError("phone");
              }}
              placeholder="98765 43210"
              maxLength={10}
              isInvalid={Boolean(fieldErrors.phone)}
            />
          </InputGroup>
          {fieldErrors.phone && <div className="invalid-feedback d-block">{fieldErrors.phone}</div>}
        </Form.Group>

        <PasswordInput
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearFieldError("password");
          }}
          minLength={6}
          icon="bi-lock"
          error={fieldErrors.password}
        />

        <Form.Group className="mb-3">
          <Form.Label>Address</Form.Label>
          <Form.Control
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              clearFieldError("address");
            }}
            isInvalid={Boolean(fieldErrors.address)}
          />
          <Form.Control.Feedback type="invalid">{fieldErrors.address}</Form.Control.Feedback>
        </Form.Group>

        <div className="row g-3 mb-3">
          <div className="col-sm-5">
            <Form.Group>
              <Form.Label>City</Form.Label>
              <Form.Control
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  clearFieldError("city");
                }}
                isInvalid={Boolean(fieldErrors.city)}
              />
              <Form.Control.Feedback type="invalid">{fieldErrors.city}</Form.Control.Feedback>
            </Form.Group>
          </div>
          <div className="col-sm-4">
            <Form.Group>
              <Form.Label>State</Form.Label>
              <Form.Select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  clearFieldError("state");
                }}
                isInvalid={Boolean(fieldErrors.state)}
              >
                <option value="">Select…</option>
                {INDIAN_STATES_AND_UTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{fieldErrors.state}</Form.Control.Feedback>
            </Form.Group>
          </div>
          <div className="col-sm-3">
            <Form.Group>
              <Form.Label>PIN code</Form.Label>
              <Form.Control
                inputMode="numeric"
                value={pincode}
                onChange={(e) => {
                  setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  clearFieldError("pincode");
                }}
                placeholder="110001"
                maxLength={6}
                isInvalid={Boolean(fieldErrors.pincode)}
              />
              <Form.Control.Feedback type="invalid">{fieldErrors.pincode}</Form.Control.Feedback>
            </Form.Group>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <Form.Group>
              <Form.Label>Emergency contact name (optional)</Form.Label>
              <Form.Control
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="e.g. a family member"
              />
            </Form.Group>
          </div>
          <div className="col-sm-6">
            <Form.Group>
              <Form.Label>Emergency contact phone (optional)</Form.Label>
              <Form.Control
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="98765 43210"
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
