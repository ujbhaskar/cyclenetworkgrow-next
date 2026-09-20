"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANNOUNCEMENT_VARIANTS, type SiteAnnouncement } from "@/lib/models/site-announcement";

export default function SiteAnnouncementForm({ announcement }: { announcement: SiteAnnouncement }) {
  const router = useRouter();
  const [form, setForm] = useState<SiteAnnouncement>(announcement);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/site-announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not save changes");
      }
      setForm(body);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 560 }}>
      <div className="form-check form-switch mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="announcement-enabled"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        <label className="form-check-label" htmlFor="announcement-enabled">
          Show banner on the home page
        </label>
      </div>

      <div className="mb-3">
        <label className="form-label">Message</label>
        <textarea
          className="form-control"
          rows={2}
          maxLength={300}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="e.g. Registrations for 1177-6.0 close on 21st Sept — sign up now!"
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Style</label>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={form.variant}
          onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value as SiteAnnouncement["variant"] }))}
        >
          {ANNOUNCEMENT_VARIANTS.map((v) => (
            <option key={v} value={v}>
              {v[0].toUpperCase() + v.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {form.message && (
        <div className={`alert alert-${form.variant} py-2`}>
          <strong>Preview:</strong> {form.message}
        </div>
      )}

      {error && <p className="text-danger small">{error}</p>}
      {saved && !error && <p className="text-success small">Saved.</p>}
      <button type="submit" className="btn btn-success" disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
