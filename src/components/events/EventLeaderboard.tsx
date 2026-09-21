"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import { Modal, ModalHeader, ModalTitle, ModalBody, Tab, Tabs } from "react-bootstrap";
import { MILESTONES_KM, type EventLeaderboardData, type LongestRide, type PlaceStat, type QualifyingRide } from "@/lib/models/rider-metric";
import type { PublicEventRider } from "@/lib/events";
import { normalizeCity, normalizeCasing } from "@/lib/registration-normalize";
import UserAvatar from "@/components/UserAvatar";
import IndiaStateMap from "./IndiaStateMap";
import SimpleBarChart from "./SimpleBarChart";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Whole days remaining until the event's start date, rounded up so "less
// than a day left" still reads as 1, not 0. Negative/zero once it's started.
function daysUntilStart(eventStartDate: string): number {
  return Math.ceil((new Date(eventStartDate).getTime() - Date.now()) / ONE_DAY_MS);
}

// Small reusable stat tile for a "longest ride" record (overall, male-only,
// female-only) — same shape, just a different filtered record and label.
function LongestRideStat({ label, icon, ride }: { label: string; icon: string; ride: LongestRide }) {
  return (
    <div>
      <div className="fs-3 fw-semibold lh-1">
        <a
          href={`https://www.strava.com/activities/${ride.activityId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View this ride on Strava"
        >
          {ride.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km
        </a>
      </div>
      <div className="text-muted small mt-1">
        <i className={`bi ${icon} text-warning me-1`} aria-hidden />
        {label} — {ride.riderName}
        {ride.city ? ` (${ride.city})` : ""}
      </div>
    </div>
  );
}

// Ranked bar-list for "top cities" / "top states" — always accurate, since
// it just ranks whatever's cleanly attributable, unlike the map below
// which can only shade states its geometry has an exact name match for.
// Shows a short slice by default with a "Show more" toggle — the full list
// is already in `places`, so expanding is instant, no extra fetch.
const PLACE_LIST_INITIAL_COUNT = 8;

function PlaceStatList({ title, icon, places }: { title: string; icon: string; places: PlaceStat[] }) {
  const [expanded, setExpanded] = useState(false);

  if (places.length === 0) {
    return null;
  }
  const maxDistance = Math.max(...places.map((p) => p.totalDistanceKm));
  const visible = expanded ? places : places.slice(0, PLACE_LIST_INITIAL_COUNT);

  return (
    <div className="flex-grow-1" style={{ minWidth: 260 }}>
      <h3 className="h6 fw-bold mb-3">
        <i className={`bi ${icon} me-2`} aria-hidden />
        {title}
      </h3>
      {visible.map((place, index) => (
        <div key={place.place} className="mb-2">
          <div className="d-flex justify-content-between small mb-1">
            <span>
              {index + 1}. {place.place}{" "}
              <span className="text-muted">
                ({place.riderCount} rider{place.riderCount === 1 ? "" : "s"})
              </span>
            </span>
            <span className="text-muted">
              {place.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </span>
          </div>
          <div className="progress" style={{ height: 6 }}>
            <div
              className="progress-bar bg-success"
              style={{ width: `${(place.totalDistanceKm / maxDistance) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {places.length > PLACE_LIST_INITIAL_COUNT && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show more (${places.length - PLACE_LIST_INITIAL_COUNT})`}
        </button>
      )}
    </div>
  );
}

// Public event-page leaderboard, modeled on the legacy portal's own event
// leaderboard (letscng.com/cng-events/1177-2024). Two tabs: the raw ranking
// table (Rank / milestone brackets / distance — click a rider to verify
// their individual rides), and an Insights tab with the aggregate stats,
// city/state/gender breakdowns, and a state map. No Points column — the
// legacy scoring formula for it isn't present anywhere in the source data,
// see docs/REQUIREMENTS.md's open question on event scoring.
export default function EventLeaderboard({
  data,
  eventStartDate,
  eventEndDate,
  registeredRiders = [],
  currentUserPhone = null,
}: {
  data: EventLeaderboardData;
  eventStartDate: string;
  eventEndDate: string;
  /** Shown as a fallback while there's no ride data yet (e.g. before the
   * event starts) — registration info, not ride results. */
  registeredRiders?: PublicEventRider[];
  /** The signed-in visitor's own phone (matches RiderMetric.phone), so
   * their own row can be highlighted/scrolled to — null for a signed-out
   * visitor or one with no phone on file. */
  currentUserPhone?: string | null;
}) {
  const {
    riders,
    totalQualifiers,
    totalDistanceKm,
    totalRides,
    finisherCount,
    longestRide,
    maleLongestRide,
    femaleLongestRide,
    topCities,
    topStates,
    allStateStats,
    bracketTotals,
    genderStats,
  } = data;
  const avgDistancePerRiderKm = totalQualifiers > 0 ? totalDistanceKm / totalQualifiers : 0;
  const daysToStart = daysUntilStart(eventStartDate);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [rides, setRides] = useState<QualifyingRide[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [nameFilter, setNameFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  // Normalized so "Kolkata"/"kolkata" collapse into one dropdown option —
  // same shared utility the admin tables use.
  const cityOptions = useMemo(
    () => [...new Set(riders.map((r) => (r.city ? normalizeCity(r.city) : "")).filter(Boolean))].sort(),
    [riders],
  );
  const stateOptions = useMemo(
    () => [...new Set(riders.map((r) => (r.state ? normalizeCasing(r.state) : "")).filter(Boolean))].sort(),
    [riders],
  );

  const filteredRiders = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    return riders.filter((r) => {
      if (name && !r.name.toLowerCase().includes(name)) return false;
      if (cityFilter && (r.city ? normalizeCity(r.city) : "") !== cityFilter) return false;
      if (stateFilter && (r.state ? normalizeCasing(r.state) : "") !== stateFilter) return false;
      return true;
    });
  }, [riders, nameFilter, cityFilter, stateFilter]);

  // -1 when signed out, no phone on file, or not a rider in this event.
  const myRowIndex = currentUserPhone ? riders.findIndex((r) => r.phone === currentUserPhone) : -1;

  const PAGE_SIZE = 50;
  // Lazy initializer, not an effect — if the viewer's own row is further
  // down than the first page, include it from the start instead of making
  // them scroll/load-more to find it.
  const [visibleCount, setVisibleCount] = useState(() =>
    myRowIndex >= 0 ? Math.max(PAGE_SIZE, myRowIndex + 1) : PAGE_SIZE,
  );
  const visibleRiders = filteredRiders.slice(0, visibleCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const myRowRef = useRef<HTMLTableRowElement | null>(null);

  // One-time scroll to the viewer's own row on load — a courtesy for when
  // it's off the initial screen (deep in a long, unsorted-by-distance-tie
  // list), not re-triggered on every re-render.
  useEffect(() => {
    myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredRiders.length));
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredRiders.length]);

  const selectedRider = riders.find((r) => r.phone === selectedPhone) ?? null;

  async function openRider(phone: string) {
    setSelectedPhone(phone);
    setRides(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: eventStartDate, end: eventEndDate });
      const res = await fetch(`/api/rider-rides/${encodeURIComponent(phone)}?${params}`);
      const json = await res.json();
      setRides(json.rides ?? []);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setSelectedPhone(null);
    setRides(null);
  }

  const bracketBars = MILESTONES_KM.map((milestone) => ({
    label: `${milestone}KM`,
    value: bracketTotals[milestone],
  }));
  const genderBars = [
    {
      label: "Men",
      value: genderStats.male.riderCount,
      sublabel: `${genderStats.male.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`,
      color: "#0d6efd",
    },
    {
      label: "Women",
      value: genderStats.female.riderCount,
      sublabel: `${genderStats.female.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`,
      color: "#d63384",
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="table" className="mb-4">
        <Tab eventKey="table" title="Leaderboard Table">
          <div className="pt-0">
            {riders.length === 0 ? (
              <div>
                <p className="text-muted">
                  {daysToStart > 1
                    ? `${daysToStart} days to go — the leaderboard opens once the event starts.`
                    : daysToStart === 1
                      ? "1 day to go — the leaderboard opens once the event starts."
                      : daysToStart === 0
                        ? "The event starts today — check back shortly for the first rides."
                        : "No qualifying rides recorded within this event's dates yet."}
                </p>
                {registeredRiders.length > 0 && (
                  <div className="mt-4">
                    <h3 className="h6 fw-bold mb-3">Registered Riders ({registeredRiders.length})</h3>
                    <div className="d-flex flex-wrap gap-3">
                      {registeredRiders.map((rider, index) => (
                        <div
                          key={`${rider.name}-${index}`}
                          className="d-flex align-items-center gap-2 border rounded p-2"
                          style={{ width: '100%' }}
                        >
                          <UserAvatar photoUrl={rider.photoUrl} />
                          <div>
                            <div className="text-truncate" style={{ maxWidth: 160 }}>
                              {rider.name}
                            </div>
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {[rider.gender, [rider.city, rider.state].filter(Boolean).join(", ")]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                  <Form.Group>
                    <Form.Label className="small mb-1">Name</Form.Label>
                    <Form.Control
                      size="sm"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder="Search by name…"
                      style={{ width: 200 }}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label className="small mb-1">City</Form.Label>
                    <Form.Select
                      size="sm"
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      style={{ width: 160 }}
                    >
                      <option value="">All cities</option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label className="small mb-1">State</Form.Label>
                    <Form.Select
                      size="sm"
                      value={stateFilter}
                      onChange={(e) => setStateFilter(e.target.value)}
                      style={{ width: 180 }}
                    >
                      <option value="">All states</option>
                      {stateOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  {(nameFilter || cityFilter || stateFilter) && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setNameFilter("");
                        setCityFilter("");
                        setStateFilter("");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                  <span className="text-muted small ms-auto">
                    {filteredRiders.length} of {riders.length} riders
                  </span>
                </div>
                <div className="cng-leaderboard-scroll">
                {/* Sticky header + sticky Rank/Rider columns so a mobile viewer
                    scrolling right through the milestone columns, or down
                    through a long roster, never loses track of who's who.
                    The wrapper itself is the (only) scroll container in both
                    directions — react-bootstrap's own `responsive` prop would
                    add a second nested one, which position:sticky can't
                    reliably straddle. */}
                <style>{`
                  .cng-leaderboard-scroll { overflow: auto; max-height: 70vh; overscroll-behavior: contain; }
                  .cng-leaderboard-scroll table thead th { position: sticky; top: 0; z-index: 2; background: #fff; }
                  .cng-leaderboard-scroll table .col-rank,
                  .cng-leaderboard-scroll table .col-name { position: sticky; z-index: 1; background: #fff; }
                  .cng-leaderboard-scroll table .col-rank { left: 0; width: 42px; }
                  .cng-leaderboard-scroll table .col-name { left: 42px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.15); }
                  .cng-leaderboard-scroll table thead th.col-rank,
                  .cng-leaderboard-scroll table thead th.col-name { z-index: 3; }
                `}</style>
                <Table hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="col-rank">Rank</th>
                      <th aria-hidden />
                      <th className="col-name">Rider</th>
                      <th className="text-end text-nowrap" title="Rules §6 — Distance Points + Consistency/Endurance bonuses; ranking's actual sort key">
                        Points
                      </th>
                      {MILESTONES_KM.map((milestone) => (
                        <th key={milestone} className="text-center">
                          {milestone}KM
                        </th>
                      ))}
                      <th className="text-center text-nowrap">Total Rides</th>
                      <th className="text-end text-nowrap">Distance (Km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRiders.map((rider, index) => {
                      const isMe = index === myRowIndex;
                      const stickyCellStyle = isMe ? { backgroundColor: "rgba(76,175,109,0.14)" } : undefined;
                      return (
                      <tr
                        key={rider.phone}
                        ref={isMe ? myRowRef : undefined}
                        role="button"
                        onClick={() => openRider(rider.phone)}
                        style={{
                          cursor: "pointer",
                          ...(isMe
                            ? { backgroundColor: "rgba(76,175,109,0.14)", boxShadow: "inset 3px 0 0 #4caf6d" }
                            : {}),
                        }}
                        title="View this rider's qualifying rides"
                      >
                        <td className="col-rank" style={stickyCellStyle}>{index + 1}</td>
                        <td>
                          <UserAvatar photoUrl={rider.photoUrl} />
                        </td>
                        <td className="col-name" style={stickyCellStyle}>
                          <div className="text-primary">
                            {rider.name}
                            {isMe && <span className="badge bg-success ms-2">You</span>}
                            {rider.isFinisher && (
                              <i
                                className="bi bi-trophy-fill text-warning ms-2"
                                title="Completed the full quota at every milestone"
                                aria-hidden
                              />
                            )}
                          </div>
                          {(rider.city || rider.state) && (
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {[rider.city, rider.state].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="text-end fw-bold">
                          {rider.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        {MILESTONES_KM.map((milestone) => (
                          <td
                            key={milestone}
                            className={`text-center ${rider.milestoneAchieved[milestone] ? "bg-success bg-opacity-10 text-success fw-semibold" : ""}`}
                            title={rider.milestoneAchieved[milestone] ? `${milestone}KM quota met` : undefined}
                          >
                            {rider.milestoneCounts[milestone] || "–"}
                          </td>
                        ))}
                        <td className="text-center">{rider.totalRides}</td>
                        <td className="text-end">
                          {rider.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </Table>
                {visibleCount < filteredRiders.length && (
                  <div ref={sentinelRef} className="text-center text-muted small py-3">
                    Loading more riders…
                  </div>
                )}
                </div>
                <div className="text-center text-muted small py-2">
                  Showing {visibleRiders.length} of {filteredRiders.length} riders
                </div>
              </>
            )}
          </div>
        </Tab>

        <Tab eventKey="insights" title="Insights">
          <div className="pt-0">
            <div className="d-flex flex-wrap gap-4 mb-4">
              <div>
                <div className="fs-3 fw-semibold lh-1">
                  {totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                </div>
                <div className="text-muted small mt-1">Total KMs</div>
              </div>
              <div>
                <div className="fs-3 fw-semibold lh-1">{totalRides.toLocaleString()}</div>
                <div className="text-muted small mt-1">Total Rides Logged</div>
              </div>
              <div>
                <div className="fs-3 fw-semibold lh-1">
                  {finisherCount}
                  <span className="text-muted fs-6"> / {totalQualifiers}</span>
                </div>
                <div className="text-muted small mt-1">
                  <i className="bi bi-trophy-fill text-warning me-1" aria-hidden />
                  Full-Quota Finishers
                </div>
              </div>
              <div>
                <div className="fs-3 fw-semibold lh-1">
                  {avgDistancePerRiderKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                </div>
                <div className="text-muted small mt-1">Avg. Distance / Rider</div>
              </div>
              {maleLongestRide && (
                <LongestRideStat label="Longest Ride (Men)" icon="bi-gender-male" ride={maleLongestRide} />
              )}
              {femaleLongestRide && (
                <LongestRideStat label="Longest Ride (Women)" icon="bi-gender-female" ride={femaleLongestRide} />
              )}
            </div>

            {(topCities.length > 0 || topStates.length > 0) && (
              <div className="d-flex flex-wrap gap-4 mb-4">
                <PlaceStatList title="Top Cities" icon="bi-buildings" places={topCities} />
                <PlaceStatList title="Top States" icon="bi-geo-alt-fill" places={topStates} />
                {allStateStats.length > 0 && <IndiaStateMap stats={allStateStats} />}
              </div>
            )}

            <div className="d-flex flex-wrap gap-4 mb-4">
              <SimpleBarChart title="Rides by Milestone Bracket" icon="bi-bar-chart-fill" bars={bracketBars} />
              <SimpleBarChart title="Riders by Gender" icon="bi-people-fill" bars={genderBars} />
            </div>
          </div>
        </Tab>
      </Tabs>

      <Modal show={selectedRider !== null} onHide={close} centered size="lg">
        <ModalHeader closeButton>
          <ModalTitle>{selectedRider?.name}&apos;s Rides</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {loading && <p className="text-muted mb-0">Loading rides…</p>}
          {!loading && rides && rides.length === 0 && (
            <p className="text-muted mb-0">No qualifying rides found for this rider.</p>
          )}
          {!loading && rides && rides.length > 0 && selectedRider && (
            <>
              <div style={{ overflowX: "auto" }}>
                <Table size="sm" hover>
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th className="text-end">Distance</th>
                      <th className="text-center">Bracket</th>
                      <th className="text-end">Points</th>
                      <th className="text-center">Strava</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rides.map((ride, index) => (
                      <tr key={ride.activityId}>
                        <td>{index + 1}</td>
                        <td className="text-nowrap">
                          {/* IST explicitly, not the viewer's local timezone — this modal is
                              for verifying exactly when a ride counted (see eventWindowMs's
                              IST-boundary handling in rider-metrics.ts), so it should read
                              the same for every admin/rider regardless of where they are. */}
                          {new Date(ride.startDate).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td>
                          {ride.type}
                          {ride.isVirtual && (
                            <span className="badge bg-secondary ms-1" title="Indoor rides earn 75% of the points (rules §6d)">
                              Indoor
                            </span>
                          )}
                        </td>
                        <td className="text-end">{ride.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</td>
                        <td className="text-center">{ride.bracket ? `${ride.bracket}KM` : "–"}</td>
                        <td className="text-end fw-semibold">
                          {ride.points.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          <a
                            href={`https://www.strava.com/activities/${ride.activityId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View this ride on Strava"
                          >
                            <i className="bi bi-box-arrow-up-right" aria-hidden />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Rules §6 — Distance Points (per-ride, summed above) plus the
                  Consistency/Endurance streak bonuses (§6b/c), which aren't
                  tied to any single ride so they're only shown as a total
                  here, not a table row. */}
              <div className="d-flex flex-wrap gap-4 border-top pt-3 mt-1">
                <div>
                  <div className="text-muted small">Distance Points</div>
                  <div className="fw-semibold">
                    {selectedRider.distancePoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-muted small">Bonus Points</div>
                  <div className="fw-semibold">
                    {selectedRider.bonusPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-muted small">Total Points</div>
                  <div className="fw-bold text-success">
                    {selectedRider.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
}
