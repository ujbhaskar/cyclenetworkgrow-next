"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NavLink } from "@/lib/models/nav-links";

type Row = { label: string; href: string };

export default function NavLinksForm({ links }: { links: NavLink[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(links.map(({ label, href }) => ({ label, href })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow(index: number, field: keyof Row, text: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: text } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, { label: "", href: "" }]);
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = rows.map((r) => ({ label: r.label.trim(), href: r.href.trim() })).filter((r) => r.label && r.href);

    if (cleaned.length === 0) {
      setError("Add at least one link.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/nav-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: cleaned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
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
      <div className="d-flex flex-column gap-2 mb-3">
        {rows.map((row, index) => (
          <div key={index} className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: 160 }}
              placeholder="Label (e.g. Events)"
              value={row.label}
              onChange={(e) => updateRow(index, "label", e.target.value)}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Link (e.g. /events or https://...)"
              value={row.href}
              onChange={(e) => updateRow(index, "href", e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={index === 0}
              onClick={() => moveRow(index, -1)}
              title="Move up"
            >
              <i className="bi bi-arrow-up" aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={index === rows.length - 1}
              onClick={() => moveRow(index, 1)}
              title="Move down"
            >
              <i className="bi bi-arrow-down" aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => removeRow(index)}
              title="Remove"
            >
              <i className="bi bi-trash3" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-outline-success btn-sm mb-3" onClick={addRow}>
        <i className="bi bi-plus-lg me-1" aria-hidden />
        Add Link
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
