"use client";

import { useMemo, useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import type { EventRider } from "@/lib/events";

type StravaFilter = "all" | "connected" | "unregistered";

const ALL = "__all__";

export default function LegacyRidersTable({ riders }: { riders: EventRider[] }) {
  const [stateFilter, setStateFilter] = useState(ALL);
  const [cityFilter, setCityFilter] = useState(ALL);
  const [genderFilter, setGenderFilter] = useState(ALL);
  const [stravaFilter, setStravaFilter] = useState<StravaFilter>("all");

  const states = useMemo(
    () => [...new Set(riders.map((r) => r.state).filter((v): v is string => Boolean(v)))].sort(),
    [riders],
  );
  const cities = useMemo(
    () => [...new Set(riders.map((r) => r.city).filter((v): v is string => Boolean(v)))].sort(),
    [riders],
  );
  const genders = useMemo(
    () => [...new Set(riders.map((r) => r.gender).filter((v): v is string => Boolean(v)))].sort(),
    [riders],
  );

  const filtered = useMemo(
    () =>
      riders
        .filter((rider) => {
          if (stateFilter !== ALL && rider.state !== stateFilter) return false;
          if (cityFilter !== ALL && rider.city !== cityFilter) return false;
          if (genderFilter !== ALL && rider.gender !== genderFilter) return false;
          const connected = Boolean(rider.stravaId);
          if (stravaFilter === "connected" && !connected) return false;
          if (stravaFilter === "unregistered" && connected) return false;
          return true;
        })
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")),
    [riders, stateFilter, cityFilter, genderFilter, stravaFilter],
  );

  // Metrics reflect the currently filtered set, so narrowing by state/city/
  // gender/Strava status updates the counts too, not just the table rows.
  const metrics = useMemo(() => {
    const uniqueCities = new Set(filtered.map((r) => r.city).filter(Boolean));
    const uniqueStates = new Set(filtered.map((r) => r.state).filter(Boolean));
    const male = filtered.filter((r) => r.gender === "Male").length;
    const female = filtered.filter((r) => r.gender === "Female").length;
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((rider, index) => (
              <tr key={rider.phone}>
                <td>{index + 1}</td>
                <td>{rider.full_name || "—"}</td>
                <td>{rider.phone}</td>
                <td>{rider.gender || "—"}</td>
                <td>{[rider.city, rider.state].filter(Boolean).join(", ") || "—"}</td>
                <td>
                  {rider.stravaId ? (
                    <a href={`https://www.strava.com/athletes/${rider.stravaId}`} target="_blank" rel="noopener noreferrer">
                      {rider.stravaId}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted text-center py-4">
                  No riders match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
