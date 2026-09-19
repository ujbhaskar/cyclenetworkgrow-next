"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import UserAvatar from "@/components/UserAvatar";
import type { RideSummary } from "@/lib/admin-rides";

const SELECT_BATCH_SIZE = 50;

export default function RidesCleanupPanel({ initialRiders }: { initialRiders: RideSummary[] }) {
  const [riders, setRiders] = useState(initialRiders);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const visibleRiders = riders.filter(
    (rider) => rider.phone.includes(query) || (rider.name ?? "").toLowerCase().includes(query),
  );

  function toggle(phone: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(phone);
      } else {
        next.delete(phone);
      }
      return next;
    });
  }

  // Both "select all" and "select 50" operate on whatever's currently
  // visible (i.e. filtered by the search box), not the full unfiltered list.
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(visibleRiders.map((r) => r.phone)) : new Set());
  }

  function selectFirst50() {
    setSelected(new Set(visibleRiders.slice(0, SELECT_BATCH_SIZE).map((r) => r.phone)));
  }

  async function deletePhones(targets: string[]) {
    if (targets.length === 0) {
      return;
    }
    if (
      !confirm(
        `Permanently delete synced rides for ${targets.length} rider${targets.length === 1 ? "" : "s"}? This cannot be undone — only do this once the data is backed up elsewhere.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/admin/rides/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones: targets }),
    });
    setDeleting(false);
    if (res.ok) {
      const deletedSet = new Set(targets);
      setRiders((current) => current.filter((rider) => !deletedSet.has(rider.phone)));
      setSelected((current) => {
        const next = new Set(current);
        targets.forEach((phone) => next.delete(phone));
        return next;
      });
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Delete failed.");
    }
  }

  return (
    <div>
      <Alert variant="danger">
        This deletes rides once the event is over and its data is backed up elsewhere. Deleted rides{" "}
        <strong>cannot be recovered</strong> — be careful.
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}
      {deleting && <Alert variant="info">Deleting…</Alert>}

      <div className="d-flex gap-2 mb-3 align-items-center">
        <Button variant="secondary" onClick={selectFirst50} disabled={deleting || visibleRiders.length === 0}>
          Select 50
        </Button>
        <Button variant="danger" onClick={() => deletePhones([...selected])} disabled={deleting || selected.size === 0}>
          Delete Selected ({selected.size})
        </Button>
        <Form.Control
          type="search"
          placeholder="Search by phone or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
          className="ms-auto"
        />
      </div>

      <p className="text-muted small">
        Showing {visibleRiders.length} of {riders.length} riders.
      </p>

      <div style={{ overflowX: "auto" }}>
        <Table hover size="sm">
          <thead>
            <tr>
              <th>
                <Form.Check
                  type="checkbox"
                  checked={visibleRiders.length > 0 && selected.size === visibleRiders.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  disabled={deleting || visibleRiders.length === 0}
                />
              </th>
              <th>Sl No.</th>
              <th></th>
              <th>Name</th>
              <th>Phone</th>
              <th className="text-end">Rides</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRiders.map((rider, index) => (
              <tr key={rider.phone}>
                <td>
                  <Form.Check
                    type="checkbox"
                    checked={selected.has(rider.phone)}
                    onChange={(e) => toggle(rider.phone, e.target.checked)}
                    disabled={deleting}
                  />
                </td>
                <td>{index + 1}</td>
                <td>
                  <UserAvatar photoUrl={rider.photoUrl} size={28} />
                </td>
                <td>{rider.name ?? <span className="text-muted">—</span>}</td>
                <td>{rider.phone}</td>
                <td className="text-end">{rider.rideCount}</td>
                <td>
                  <Button size="sm" variant="danger" onClick={() => deletePhones([rider.phone])} disabled={deleting}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {visibleRiders.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted text-center py-4">
                  {riders.length === 0 ? "No synced rides docs left." : "No riders match this search."}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
