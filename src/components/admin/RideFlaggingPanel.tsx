"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import UserAvatar from "@/components/UserAvatar";
import type { RiderSearchResult, RideActivity } from "@/lib/admin-ride-flagging";
import type { RideRulesConfig } from "@/lib/models/ride-rules";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function RideFlaggingPanel({ rideRules }: { rideRules: RideRulesConfig }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RiderSearchResult[]>([]);

  const [pickedRider, setPickedRider] = useState<RiderSearchResult | null>(null);
  const [loadingRides, setLoadingRides] = useState(false);
  const [activities, setActivities] = useState<RideActivity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) {
      return;
    }
    setSearching(true);
    setError(null);
    const res = await fetch(`/api/admin/rides/flag/search?q=${encodeURIComponent(query.trim())}`);
    const body = await res.json().catch(() => ({ riders: [] }));
    setSearching(false);
    setResults(body.riders ?? []);
  }

  async function pickRider(rider: RiderSearchResult) {
    if (!rider.phone) {
      setError("This rider has no phone number on file.");
      return;
    }
    setPickedRider(rider);
    setResults([]);
    setActivities([]);
    setSelected(new Set());
    setError(null);
    setSuccess(null);
    setLoadingRides(true);
    const res = await fetch(`/api/admin/rides/flag/${encodeURIComponent(rider.phone)}`);
    const body = await res.json().catch(() => ({ activities: [] }));
    setLoadingRides(false);
    setActivities(body.activities ?? []);
  }

  function updateActivity(id: string, patch: Partial<RideActivity>) {
    setActivities((current) => current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function handleRemove(activityId: string) {
    if (!pickedRider?.phone) {
      return;
    }
    if (!confirm("Permanently delete this activity? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/admin/rides/flag/${encodeURIComponent(pickedRider.phone)}/${activityId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setActivities((current) => current.filter((a) => a.id !== activityId));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(activityId);
        return next;
      });
    } else {
      setError("Couldn't delete that activity.");
    }
  }

  async function handleUpdateSelected() {
    if (!pickedRider?.phone || selected.size === 0) {
      return;
    }
    const toUpdate = activities.filter((a) => selected.has(a.id));
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/admin/rides/flag/${encodeURIComponent(pickedRider.phone)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activities: toUpdate }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setSuccess(`Updated ${body.updated} ride${body.updated === 1 ? "" : "s"} in the DB.`);
    } else {
      setError(body.error ?? "Update failed.");
    }
  }

  return (
    <div>
      <div className="bg-white border rounded p-3 mb-4">
        <Form.Label>Search by name, city, or phone</Form.Label>
        <div className="d-flex gap-2">
          <Form.Control
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Nishant Patel"
          />
          <Button variant="outline-primary" onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? "…" : "Search"}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="border rounded mt-2" style={{ maxHeight: 260, overflowY: "auto" }}>
            {results.map((rider) => (
              <button
                key={rider.athleteId}
                type="button"
                className="btn btn-light w-100 d-flex align-items-center gap-2 text-start border-0 rounded-0 py-2"
                onClick={() => pickRider(rider)}
              >
                <UserAvatar photoUrl={rider.profileImageUrl} size={32} />
                <div>
                  <div className="fw-semibold">{rider.name}</div>
                  <div className="text-muted small">
                    {rider.phone ?? "no phone"} · {[rider.city, rider.state].filter(Boolean).join(", ") || "no location"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {loadingRides && <Alert variant="info">Loading rides…</Alert>}

      {pickedRider && !loadingRides && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">
              Rides for {pickedRider.name} ({activities.length})
            </h2>
            <Button onClick={handleUpdateSelected} disabled={saving || selected.size === 0}>
              {saving ? "Updating…" : `Update Selected (${selected.size}) in DB`}
            </Button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <Table striped bordered hover size="sm" className="text-center align-middle">
              <thead>
                <tr>
                  <th>
                    <Form.Check
                      type="checkbox"
                      checked={activities.length > 0 && selected.size === activities.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(activities.map((a) => a.id)) : new Set())}
                    />
                  </th>
                  <th>SN.</th>
                  <th>Activity</th>
                  <th>Flagged</th>
                  <th>Distance (km)</th>
                  <th>Elevation (m)</th>
                  <th>Moving Time</th>
                  <th>Elapsed Time</th>
                  <th>Elapsed/Moving</th>
                  <th>Start Time</th>
                  <th>Type</th>
                  <th>Trainer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity, index) => {
                  const movingTime = Number(activity.moving_time ?? 0);
                  const elapsedTime = Number(activity.elapsed_time ?? 0);
                  const ratio = movingTime > 0 ? elapsedTime / movingTime : null;
                  const distanceKm = Number(activity.distance) / 1000;
                  const isVirtual = activity.type === "VirtualRide" || activity.trainer;
                  const overRatioLimit = ratio !== null && ratio > rideRules.elapsedToMovingRatioMax;
                  const overVirtualDistanceLimit = isVirtual && distanceKm > rideRules.maxVirtualRideDistanceKm;
                  return (
                  <tr key={activity.id}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={selected.has(activity.id)}
                        onChange={(e) => toggle(activity.id, e.target.checked)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>
                      <a href={`https://www.strava.com/activities/${activity.id}`} target="_blank" rel="noopener noreferrer">
                        {activity.name || activity.id}
                      </a>
                    </td>
                    <td>{activity.flagged && <Badge bg="warning">Flagged</Badge>}</td>
                    {/* Flagged when a virtual/trainer ride exceeds the admin-configured max distance. */}
                    <td className={overVirtualDistanceLimit ? "text-danger fw-semibold" : ""}>{distanceKm.toFixed(2)}</td>
                    <td style={{ minWidth: 100 }}>
                      <Form.Control
                        type="number"
                        size="sm"
                        value={activity.total_elevation_gain}
                        onChange={(e) => updateActivity(activity.id, { total_elevation_gain: e.target.value })}
                      />
                    </td>
                    <td>{formatDuration(movingTime)}</td>
                    {/* Flagged when elapsed time exceeds the admin-configured multiple of moving time (rules §7d). */}
                    <td className={overRatioLimit ? "text-danger fw-semibold" : ""}>{formatDuration(elapsedTime)}</td>
                    <td className={overRatioLimit ? "text-danger fw-semibold" : ""}>
                      {ratio !== null ? `${ratio.toFixed(2)}x` : "—"}
                    </td>
                    <td className="text-nowrap">{new Date(activity.start_date).toLocaleString()}</td>
                    <td>{activity.type}</td>
                    <td>{activity.trainer ? "Yes" : "No"}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1 justify-content-center">
                        <Button size="sm" variant="warning" onClick={() => updateActivity(activity.id, { flagged: !activity.flagged })}>
                          Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            updateActivity(activity.id, { type: activity.type === "VirtualRide" ? "Ride" : "VirtualRide" })
                          }
                        >
                          Virtual Ride
                        </Button>
                        <Button size="sm" variant="success" onClick={() => updateActivity(activity.id, { trainer: !activity.trainer })}>
                          Trainer
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => handleRemove(activity.id)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {activities.length === 0 && (
                  <tr>
                    <td colSpan={13} className="text-muted text-center py-4">
                      No rides for this rider.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
