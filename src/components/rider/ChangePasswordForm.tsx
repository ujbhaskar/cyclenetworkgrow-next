"use client";

import { useState, type FormEvent } from "react";

// Deliberately separate from ProfileEditForm's "Save Changes" — a password
// change is a distinct, higher-stakes action, so it gets its own
// reveal-on-click form and its own submit button rather than living inside
// the profile PATCH.
export default function ChangePasswordForm() {
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setEditing(false);
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not change password");
      }
      setSaved(true);
      setEditing(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mb-4">
        {saved && <p className="text-success small mb-2">Password changed.</p>}
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => {
            setSaved(false);
            setEditing(true);
          }}
        >
          Change Password
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mb-4">
      <div className="mb-3">
        <label htmlFor="newPassword" className="form-label">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          className="form-control"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoFocus
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="confirmPassword" className="form-label">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="form-control"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-danger small">{error}</p>}
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-success" disabled={saving}>
          {saving ? "Saving…" : "Save Password"}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
