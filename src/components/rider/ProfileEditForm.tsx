"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isSyntheticEmail } from "@/lib/auth/phone";
import type { UserProfile } from "@/lib/models/user";

export default function ProfileEditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  // A phone-signup account's Firebase Auth email is an internal synthetic
  // address (see src/lib/auth/phone.ts) — start the field blank instead of
  // showing that, so the user adds a real one rather than resubmitting it.
  const [email, setEmail] = useState(profile.email && !isSyntheticEmail(profile.email) ? profile.email : "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone, address }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save changes");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <label htmlFor="firstName" className="form-label">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            className="form-control"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="col-sm-6">
          <label htmlFor="lastName" className="form-label">
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            className="form-control"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="form-control"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="form-text">Used to log in — changing it updates your sign-in email too.</div>
      </div>

      <div className="mb-3">
        <label htmlFor="phone" className="form-label">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          className="form-control"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 9876543210"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="address" className="form-label">
          Address
        </label>
        <textarea
          id="address"
          className="form-control"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {error && <p className="text-danger small">{error}</p>}
      {saved && !error && <p className="text-success small">Saved.</p>}
      <button type="submit" className="btn btn-success" disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
