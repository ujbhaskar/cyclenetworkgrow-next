"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HeroStat } from "@/lib/models/hero-stats";
import type { SiteStats } from "@/lib/site-stats";

type Row = { label: string; value: string };

export default function HeroStatsForm({ stats, reference }: { stats: HeroStat[]; reference: SiteStats }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(stats.map(({ label, value }) => ({ label, value })));
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
    setRows((prev) => [...prev, { label: "", value: "" }]);
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
    const cleaned = rows.map((r) => ({ label: r.label.trim(), value: r.value.trim() })).filter((r) => r.label && r.value);

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/hero-stats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats: cleaned }),
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
    <div>
      <div className="alert alert-secondary py-2 px-3 small mb-3">
        <strong>Real current numbers</strong> (for reference — nothing here updates automatically,
        these tiles are plain text you control): {reference.riderCount.toLocaleString()}+ riders,{" "}
        {(reference.totalDistanceKm / 1000).toFixed(0)}K+ km ridden, {reference.cityCount}+ cities,{" "}
        {reference.eventCount} events hosted.
      </div>

      <form onSubmit={onSubmit}>
        <div className="d-flex flex-column gap-2 mb-3">
          {rows.map((row, index) => (
            <div key={index} className="d-flex align-items-center gap-2">
              <input
                type="text"
                className="form-control"
                style={{ maxWidth: 160 }}
                placeholder="Value (e.g. 375+)"
                value={row.value}
                onChange={(e) => updateRow(index, "value", e.target.value)}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Label (e.g. Riders)"
                value={row.label}
                onChange={(e) => updateRow(index, "label", e.target.value)}
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
          Add Tile
        </button>

        {error && <p className="text-danger small">{error}</p>}
        {saved && !error && <p className="text-success small">Saved.</p>}
        <div>
          <button type="submit" className="btn btn-success" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
