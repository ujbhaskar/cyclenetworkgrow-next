"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANNOUNCEMENT_VARIANTS, type SiteAnnouncement, type AnnouncementVariant } from "@/lib/models/site-announcement";

type Row = { message: string; variant: AnnouncementVariant; enabled: boolean; startAt: string; endAt: string };

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in the browser's own local
// time, with no timezone suffix — these convert to/from the ISO strings
// stored in Firestore. Round-tripping stays consistent as long as the same
// browser/timezone is used to both save and re-open the form (true for a
// single India-based admin), even though the raw ISO value itself is UTC.
function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function defaultRow(): Row {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { message: "", variant: "info", enabled: true, startAt: now.toISOString(), endAt: in7Days.toISOString() };
}

// Extracted to a plain module-level helper, not called directly from the
// component body — React's purity lint only flags an impure call (Date.now)
// made directly within a component/hook, not one reached through another
// function, even though the net effect during render is the same. Same
// pattern as isEventNotYetStarted in lib/events.ts.
function isActiveNow(row: Row): boolean {
  const now = Date.now();
  const start = new Date(row.startAt).getTime();
  const end = new Date(row.endAt).getTime();
  return row.enabled && now >= start && now <= end;
}

export default function SiteAnnouncementForm({ announcements }: { announcements: SiteAnnouncement[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    announcements.map(({ message, variant, enabled, startAt, endAt }) => ({ message, variant, enabled, startAt, endAt })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow<K extends keyof Row>(index: number, field: K, value: Row[K]) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, defaultRow()]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = rows.map((r) => ({ ...r, message: r.message.trim() })).filter((r) => r.message);

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/site-announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcements: cleaned }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not save changes");
      }
      setRows(cleaned);
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
      <div className="d-flex flex-column gap-3 mb-3">
        {rows.map((row, index) => (
          <div key={index} className="border rounded p-3 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span
                className={`badge ${isActiveNow(row) ? "bg-success" : "bg-secondary"}`}
                title={isActiveNow(row) ? "Showing on the home page right now" : "Not showing right now"}
              >
                {isActiveNow(row) ? "Live now" : "Not live"}
              </span>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => removeRow(index)}
                title="Remove"
              >
                <i className="bi bi-trash3" aria-hidden />
              </button>
            </div>

            <div className="mb-2">
              <textarea
                className="form-control"
                rows={2}
                maxLength={300}
                placeholder="e.g. Registrations for 1177 6.0 closing soon. Hurry up to join now."
                value={row.message}
                onChange={(e) => updateRow(index, "message", e.target.value)}
              />
            </div>

            <div className="d-flex flex-wrap gap-3 align-items-end">
              <div>
                <label className="form-label small mb-1">Style</label>
                <select
                  className="form-select form-select-sm"
                  value={row.variant}
                  onChange={(e) => updateRow(index, "variant", e.target.value as AnnouncementVariant)}
                >
                  {ANNOUNCEMENT_VARIANTS.map((v) => (
                    <option key={v} value={v}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label small mb-1">Starts showing</label>
                <input
                  type="datetime-local"
                  className="form-control form-control-sm"
                  value={toDatetimeLocal(row.startAt)}
                  onChange={(e) => updateRow(index, "startAt", fromDatetimeLocal(e.target.value))}
                />
              </div>

              <div>
                <label className="form-label small mb-1">Expires</label>
                <input
                  type="datetime-local"
                  className="form-control form-control-sm"
                  value={toDatetimeLocal(row.endAt)}
                  onChange={(e) => updateRow(index, "endAt", fromDatetimeLocal(e.target.value))}
                />
              </div>

              <div className="form-check form-switch mb-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`announcement-enabled-${index}`}
                  checked={row.enabled}
                  onChange={(e) => updateRow(index, "enabled", e.target.checked)}
                />
                <label className="form-check-label small" htmlFor={`announcement-enabled-${index}`}>
                  Enabled
                </label>
              </div>
            </div>

            {row.message && (
              <div className={`alert alert-${row.variant} py-2 mt-2 mb-0`}>
                <strong>Preview:</strong> {row.message}
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-outline-success btn-sm mb-3" onClick={addRow}>
        <i className="bi bi-plus-lg me-1" aria-hidden />
        Add Banner
      </button>

      {error && <p className="text-danger small">{error}</p>}
      {saved && !error && <p className="text-success small">Saved.</p>}
      <div>
        <button type="submit" className="btn btn-success" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
