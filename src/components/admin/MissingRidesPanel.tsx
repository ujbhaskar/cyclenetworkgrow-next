"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import type { CandidateActivity, RiderSearchResult } from "@/lib/admin-missing-rides";
import type { RideRulesConfig } from "@/lib/models/ride-rules";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function MissingRidesPanel({ rideRules }: { rideRules: RideRulesConfig }) {
  const [nameQuery, setNameQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RiderSearchResult[]>([]);
  const [selectedRider, setSelectedRider] = useState<RiderSearchResult | null>(null);

  const [phone, setPhone] = useState("");
  const [athleteIdInput, setAthleteIdInput] = useState("");
  const [minDistanceKm, setMinDistanceKm] = useState(rideRules.minRideDistanceKm);
  const [afterDate, setAfterDate] = useState(rideRules.missingRidesDefaultAfterDate);

  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(null);
  const [activities, setActivities] = useState<CandidateActivity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function handleSearch() {
    if (!nameQuery.trim()) {
      return;
    }
    setSearching(true);
    setError(null);
    const res = await fetch(`/api/admin/rides/missing/search?q=${encodeURIComponent(nameQuery.trim())}`);
    const body = await res.json().catch(() => ({ riders: [] }));
    setSearching(false);
    setSearchResults(body.riders ?? []);
  }

  function pickRider(rider: RiderSearchResult) {
    setSelectedRider(rider);
    setSearchResults([]);
    setPhone("");
    setAthleteIdInput("");
  }

  // Prefer a rider picked from name search; otherwise whichever manual
  // field has something in it (athlete id first — a direct id lookup, no
  // query needed).
  function currentIdentifier(): { phone?: string; athleteId?: string } | null {
    if (selectedRider) {
      return { athleteId: selectedRider.athleteId };
    }
    if (athleteIdInput.trim()) {
      return { athleteId: athleteIdInput.trim() };
    }
    if (phone.trim()) {
      return { phone: phone.trim() };
    }
    return null;
  }

  async function handleFetch() {
    const identifier = currentIdentifier();
    if (!identifier) {
      return;
    }
    setFetching(true);
    setError(null);
    setSuccess(null);
    setActivities([]);
    setSelected(new Set());
    const res = await fetch("/api/admin/rides/missing/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...identifier, minDistanceKm, afterDate }),
    });
    const body = await res.json().catch(() => ({}));
    setFetching(false);
    if (res.ok) {
      setAthleteId(body.athleteId);
      setResolvedPhone(body.phone);
      setActivities(body.activities);
      setSelected(new Set(body.activities.map((a: CandidateActivity) => a.id)));
    } else {
      setAthleteId(null);
      setResolvedPhone(null);
      setError(body.error ?? "Fetch failed.");
    }
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

  async function handleSync() {
    if (!athleteId || !resolvedPhone || selected.size === 0) {
      return;
    }
    const toSync = activities.filter((a) => selected.has(a.id));
    setSyncing(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/admin/rides/missing/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: resolvedPhone, athleteId, activities: toSync }),
    });
    const body = await res.json().catch(() => ({}));
    setSyncing(false);
    if (res.ok) {
      setSuccess(`Synced ${body.synced} ride${body.synced === 1 ? "" : "s"} to phone ${resolvedPhone}.`);
      setActivities((current) => current.filter((a) => !selected.has(a.id)));
      setSelected(new Set());
    } else {
      setError(body.error ?? "Sync failed.");
    }
  }

  const identifier = currentIdentifier();

  return (
    <div>
      <div className="bg-white border rounded p-3 mb-4" style={{ maxWidth: 480 }}>
        <Form.Group className="mb-2">
          <Form.Label>Find Rider by Name</Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Nishant Patel"
            />
            <Button variant="outline-primary" onClick={handleSearch} disabled={searching || !nameQuery.trim()}>
              {searching ? "…" : "Search"}
            </Button>
          </div>
        </Form.Group>

        {searchResults.length > 0 && (
          <div className="border rounded mb-2" style={{ maxHeight: 220, overflowY: "auto" }}>
            {searchResults.map((rider) => (
              <button
                key={rider.athleteId}
                type="button"
                className="btn btn-light w-100 text-start border-0 rounded-0 py-2"
                onClick={() => pickRider(rider)}
              >
                <div className="fw-semibold">{rider.name}</div>
                <div className="text-muted small">
                  {rider.phone ?? "no phone"} · {[rider.city, rider.state].filter(Boolean).join(", ") || "no location"}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedRider && (
          <Alert variant="info" className="d-flex justify-content-between align-items-center py-2">
            <span>
              Selected: <strong>{selectedRider.name}</strong> ({selectedRider.phone ?? "no phone"})
            </span>
            <Button size="sm" variant="outline-secondary" onClick={() => setSelectedRider(null)}>
              Clear
            </Button>
          </Alert>
        )}

        <div className="text-muted small text-center my-2">— or —</div>

        <Form.Group className="mb-2">
          <Form.Label>Phone Number</Form.Label>
          <Form.Control
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSelectedRider(null);
            }}
            placeholder="e.g. 9876543210"
            disabled={Boolean(selectedRider)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Strava Athlete ID</Form.Label>
          <Form.Control
            value={athleteIdInput}
            onChange={(e) => {
              setAthleteIdInput(e.target.value);
              setSelectedRider(null);
            }}
            placeholder="e.g. 20339250"
            disabled={Boolean(selectedRider)}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Minimum Distance (km)</Form.Label>
          <Form.Control
            type="number"
            value={minDistanceKm}
            onChange={(e) => setMinDistanceKm(Number(e.target.value))}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Activities After</Form.Label>
          <Form.Control type="date" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} />
        </Form.Group>
        <Button onClick={handleFetch} disabled={fetching || !identifier}>
          {fetching ? "Fetching…" : "Fetch Rides from Strava"}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {activities.length > 0 && (
        <div>
          <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
            <Button onClick={handleSync} disabled={syncing || selected.size === 0}>
              {syncing ? "Syncing…" : `Sync Selected (${selected.size}) with CNG DB`}
            </Button>
            <div>Fetched activities:</div>
          </div>
          <Table responsive striped bordered hover size="sm" className="text-center align-middle">
            <thead>
              <tr>
                <th>
                  <Form.Check
                    type="checkbox"
                    checked={selected.size === activities.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(activities.map((a) => a.id)) : new Set())}
                  />
                </th>
                <th>SN.</th>
                <th>Activity</th>
                <th>Distance (km)</th>
                <th>Virtual/Trainer?</th>
                <th>Elevation (m)</th>
                <th>Moving Time</th>
                <th>Elapsed Time</th>
                <th>Elapsed/Moving</th>
                <th>Flagged</th>
                <th>Start Date</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity, index) => {
                const ratio = activity.movingTime > 0 ? activity.elapsedTime / activity.movingTime : null;
                const isVirtual = activity.type === "VirtualRide" || activity.trainer;
                const overRatioLimit = ratio !== null && ratio > rideRules.elapsedToMovingRatioMax;
                const overVirtualDistanceLimit = isVirtual && activity.distanceKm > rideRules.maxVirtualRideDistanceKm;
                return (
                  <tr key={activity.id}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        className="d-flex justify-content-center"
                        checked={selected.has(activity.id)}
                        onChange={(e) => toggle(activity.id, e.target.checked)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>
                      <a
                        href={`https://www.strava.com/activities/${activity.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {activity.name || activity.id}
                      </a>
                    </td>
                    {/* Flagged when a virtual/trainer ride exceeds the admin-configured max distance. */}
                    <td className={overVirtualDistanceLimit ? "text-danger fw-semibold" : ""}>
                      {activity.distanceKm.toFixed(2)}
                    </td>
                    <td>{isVirtual ? "Yes" : "No"}</td>
                    <td>{activity.elevationM.toLocaleString()}</td>
                    <td>{formatDuration(activity.movingTime)}</td>
                    {/* Flagged when elapsed time exceeds the admin-configured multiple of moving time (rules §7d). */}
                    <td className={overRatioLimit ? "text-danger fw-semibold" : ""}>{formatDuration(activity.elapsedTime)}</td>
                    <td className={overRatioLimit ? "text-danger fw-semibold" : ""}>
                      {ratio !== null ? `${ratio.toFixed(2)}x` : "—"}
                    </td>
                    <td>{activity.flagged && <Badge bg="warning">Flagged</Badge>}</td>
                    <td>{new Date(activity.startDate).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {!fetching && activities.length === 0 && athleteId && (
        <p className="text-muted">No qualifying activities found for this rider in that window.</p>
      )}
    </div>
  );
}
