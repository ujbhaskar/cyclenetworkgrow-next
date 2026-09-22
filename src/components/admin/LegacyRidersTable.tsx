"use client";

import { useMemo, useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";
import type { EventRider } from "@/lib/events";
import { normalizeCity, normalizeCasing, normalizeGender } from "@/lib/registration-normalize";
import EditEventRiderModal from "./EditEventRiderModal";

type StravaFilter = "all" | "connected" | "unregistered";

const ALL = "__all__";

// This data is normally already normalized at sync time
// (legacy-registrations.ts), but riders added some other way (manual entry,
// a resync predating that normalization) can still have raw casing — same
// defensive re-normalize-at-display-time pattern as UsersTable's filters.
function riderCity(rider: EventRider): string {
  return rider.city ? normalizeCity(rider.city) : "";
}
function riderState(rider: EventRider): string {
  return rider.state ? normalizeCasing(rider.state) : "";
}
function riderGender(rider: EventRider): string {
  return rider.gender ? normalizeGender(rider.gender) : "";
}

export default function LegacyRidersTable({ eventId, riders: initialRiders }: { eventId: string; riders: EventRider[] }) {
  const [riders, setRiders] = useState(initialRiders);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState(ALL);
  const [cityFilter, setCityFilter] = useState(ALL);
  const [genderFilter, setGenderFilter] = useState(ALL);
  const [stravaFilter, setStravaFilter] = useState<StravaFilter>("all");
  const [editingRider, setEditingRider] = useState<EventRider | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const states = useMemo(() => [...new Set(riders.map(riderState).filter(Boolean))].sort(), [riders]);
  const cities = useMemo(() => [...new Set(riders.map(riderCity).filter(Boolean))].sort(), [riders]);
  const genders = useMemo(() => [...new Set(riders.map(riderGender).filter(Boolean))].sort(), [riders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return riders
      .filter((rider) => {
        if (q && !(rider.full_name ?? "").toLowerCase().includes(q) && !rider.phone.includes(q)) return false;
        if (stateFilter !== ALL && riderState(rider) !== stateFilter) return false;
        if (cityFilter !== ALL && riderCity(rider) !== cityFilter) return false;
        if (genderFilter !== ALL && riderGender(rider) !== genderFilter) return false;
        const connected = Boolean(rider.stravaId);
        if (stravaFilter === "connected" && !connected) return false;
        if (stravaFilter === "unregistered" && connected) return false;
        return true;
      })
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [riders, query, stateFilter, cityFilter, genderFilter, stravaFilter]);

  function handleRiderSaved(previousPhone: string, updated: EventRider) {
    setRiders((list) => list.map((r) => (r.phone === previousPhone ? updated : r)));
    setEditingRider(null);
    setSavedToast(`${updated.full_name || "Rider"}'s details were updated.`);
  }

  // Metrics reflect the currently filtered set, so narrowing by state/city/
  // gender/Strava status updates the counts too, not just the table rows.
  const metrics = useMemo(() => {
    const uniqueCities = new Set(filtered.map(riderCity).filter(Boolean));
    const uniqueStates = new Set(filtered.map(riderState).filter(Boolean));
    const male = filtered.filter((r) => riderGender(r) === "Male").length;
    const female = filtered.filter((r) => riderGender(r) === "Female").length;
    const stravaConnected = filtered.filter((r) => r.stravaId).length;
    return {
      total: filtered.length,
      cities: uniqueCities.size,
      states: uniqueStates.size,
      male,
      female,
      stravaConnected,
      stravaUnregistered: filtered.length - stravaConnected,
    };
  }, [filtered]);

  return (
    <div>
      <div className="d-flex flex-wrap gap-4 mb-4">
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.total}</div>
          <div className="text-muted small mt-1">Riders</div>
        </div>
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.cities}</div>
          <div className="text-muted small mt-1">Cities</div>
        </div>
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.states}</div>
          <div className="text-muted small mt-1">States</div>
        </div>
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.male}</div>
          <div className="text-muted small mt-1">Male</div>
        </div>
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.female}</div>
          <div className="text-muted small mt-1">Female</div>
        </div>
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.stravaConnected}</div>
          <div className="text-muted small mt-1">Strava Connected</div>
        </div>
        <div>
          <div className="fs-4 fw-semibold lh-1">{metrics.stravaUnregistered}</div>
          <div className="text-muted small mt-1">Strava Unregistered</div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-3 mb-3">
        <Form.Control
          style={{ width: 220 }}
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
        />
        <Form.Select style={{ width: 200 }} size="sm" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value={ALL}>All states</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Form.Select>
        <Form.Select style={{ width: 200 }} size="sm" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value={ALL}>All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          style={{ width: 160 }}
          size="sm"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
        >
          <option value={ALL}>All genders</option>
          {genders.map((gender) => (
            <option key={gender} value={gender}>
              {gender}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          style={{ width: 200 }}
          size="sm"
          value={stravaFilter}
          onChange={(e) => setStravaFilter(e.target.value as StravaFilter)}
        >
          <option value="all">All riders</option>
          <option value="connected">Strava connected</option>
          <option value="unregistered">Strava unregistered</option>
        </Form.Select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <Table responsive hover size="sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Location</th>
              <th>Strava Athlete Id</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((rider, index) => (
              <tr key={rider.phone}>
                <td>{index + 1}</td>
                <td>{rider.full_name || "—"}</td>
                <td>{rider.phone}</td>
                <td>{riderGender(rider) || "—"}</td>
                <td>{[riderCity(rider), riderState(rider)].filter(Boolean).join(", ") || "—"}</td>
                <td>
                  {rider.stravaId ? (
                    <a href={`https://www.strava.com/athletes/${rider.stravaId}`} target="_blank" rel="noopener noreferrer">
                      {rider.stravaId}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setEditingRider(rider)}
                    title="Fix this rider's name/city/state/phone"
                  >
                    <i className="bi bi-pencil" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted text-center py-4">
                  No riders match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <EditEventRiderModal
        key={editingRider?.phone}
        eventId={eventId}
        rider={editingRider}
        onClose={() => setEditingRider(null)}
        onSaved={handleRiderSaved}
      />

      <ToastContainer position="top-center" className="p-3" style={{ zIndex: 1100 }}>
        <Toast bg="success" onClose={() => setSavedToast(null)} show={!!savedToast} delay={3000} autohide>
          <Toast.Body className="text-white">{savedToast}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
