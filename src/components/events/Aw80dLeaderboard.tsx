"use client";

import { useEffect, useRef, useState } from "react";
import Table from "react-bootstrap/Table";
import { Modal, ModalHeader, ModalTitle, ModalBody, Tab, Tabs, Badge } from "react-bootstrap";
import type { Aw80dLeaderboardData, Aw80dRider, Aw80dVerificationRide } from "@/lib/models/aw80d";
import UserAvatar from "@/components/UserAvatar";

const MEDAL_BADGE: Record<string, { label: string; className: string }> = {
  gold: { label: "Gold", className: "bg-warning text-dark" },
  silver: { label: "Silver", className: "bg-secondary bg-opacity-50" },
  bronze: { label: "Bronze", className: "bg-danger bg-opacity-25 text-danger-emphasis" },
};

// Rules §6b — only each team's top 20 riders by distance count toward the
// team goal. Kept in sync with TOP_N_RIDERS_FOR_TEAM in src/lib/aw80d.ts.
const TOP_N_COUNTED_TOWARD_TEAM_GOAL = 20;

// Fun-fact yardsticks for the main leaderboard's totals — real-world
// distances/heights, not event rules.
const EARTH_EQUATOR_KM = 40075;
const EARTH_MOON_KM = 384400;
const EVEREST_HEIGHT_M = 8849;
const KARMAN_LINE_M = 100000; // edge of space

function distanceFunFact(totalDistanceKm: number): string {
  const earthLaps = totalDistanceKm / EARTH_EQUATOR_KM;
  const moonTrips = totalDistanceKm / EARTH_MOON_KM;
  return `≈ ${earthLaps.toLocaleString(undefined, { maximumFractionDigits: 1 })} laps around the Earth, or ${moonTrips.toLocaleString(undefined, { maximumFractionDigits: 1 })}x to the Moon`;
}

function elevationFunFact(totalElevationM: number): string {
  const everestClimbs = totalElevationM / EVEREST_HEIGHT_M;
  const spaceEdgeTrips = totalElevationM / KARMAN_LINE_M;
  return `≈ ${everestClimbs.toLocaleString(undefined, { maximumFractionDigits: 0 })}x up Mount Everest, or ${spaceEdgeTrips.toLocaleString(undefined, { maximumFractionDigits: 1 })}x past the edge of space`;
}

// Mirrors eventWindowBounds's IST-day handling in src/lib/aw80d.ts, so
// "has the event ended" agrees with the same calendar day the server uses
// to decide which rides count.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function hasEventEnded(eventEndDate: string): boolean {
  const eventEndMs = new Date(eventEndDate).getTime() - IST_OFFSET_MS + ONE_DAY_MS - 1;
  return Date.now() > eventEndMs;
}

function RiderList({ title, riders, unit }: { title: string; riders: Aw80dRider[]; unit: "distance" | "elevation" }) {
  if (riders.length === 0) {
    return null;
  }
  return (
    <div className="flex-grow-1" style={{ minWidth: 260 }}>
      <h3 className="h6 fw-bold mb-3">{title}</h3>
      {riders.map((rider, index) => (
        <div key={rider.phone} className="d-flex align-items-center gap-2 mb-2">
          <span className="text-muted" style={{ width: 20 }}>
            {index + 1}.
          </span>
          <UserAvatar photoUrl={rider.photoUrl} size={28} />
          <div className="flex-grow-1">
            <div className="small">{rider.name}</div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              {rider.teamName}
            </div>
          </div>
          <span className="small text-muted">
            {unit === "distance"
              ? `${rider.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
              : `${rider.totalElevationM.toLocaleString(undefined, { maximumFractionDigits: 2 })} m`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Aw80dLeaderboard({
  data,
  eventStartDate,
  eventEndDate,
}: {
  data: Aw80dLeaderboardData;
  eventStartDate: string;
  eventEndDate: string;
}) {
  const { teams, riders, topMaleByDistance, topFemaleByDistance, topMaleByElevation, topFemaleByElevation } = data;
  const eventEnded = hasEventEnded(eventEndDate);

  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [rides, setRides] = useState<Aw80dVerificationRide[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const selectedTeam = teams.find((t) => t.teamId === selectedTeamId) ?? null;
  const selectedTeamMembers = selectedTeamId
    ? riders.filter((r) => r.teamId === selectedTeamId).slice().sort((a, b) => b.totalPoints - a.totalPoints)
    : [];

  function toggleTeam(teamId: string) {
    setSelectedTeamId((current) => (current === teamId ? null : teamId));
  }

  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleRiders = riders.slice(0, visibleCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, riders.length));
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [riders.length]);

  const selectedRider = riders.find((r) => r.phone === selectedPhone) ?? null;

  async function openRider(phone: string) {
    setSelectedPhone(phone);
    setRides(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: eventStartDate, end: eventEndDate });
      const res = await fetch(`/api/aw80d-rider-rides/${encodeURIComponent(phone)}?${params}`);
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

  return (
    <div>
      <div className="d-flex flex-wrap gap-4 mb-4">
        <div>
          <div className="fs-3 fw-semibold lh-1">{teams.filter((t) => t.qualifies).length}</div>
          <div className="text-muted small mt-1">
            <span className="text-muted">/ {teams.length}</span> Teams Qualified
          </div>
        </div>
        <div>
          <div className="fs-3 fw-semibold lh-1">{data.finisherCount}</div>
          <div className="text-muted small mt-1">
            <i className="bi bi-trophy-fill text-warning me-1" aria-hidden />
            Individual Finishers ({data.finisherTargetKm.toLocaleString()}km+)
          </div>
          <div className="small mt-1 d-flex gap-3">
            <span className="text-warning-emphasis">
              <Badge bg="warning" className="text-dark me-1">
                Gold
              </Badge>
              {data.goldCount}
            </span>
            <span>
              <Badge bg="secondary" className="bg-opacity-50 me-1">
                Silver
              </Badge>
              {data.silverCount}
            </span>
            <span>
              <Badge bg="danger" className="bg-opacity-25 text-danger-emphasis me-1">
                Bronze
              </Badge>
              {data.bronzeCount}
            </span>
          </div>
        </div>
        <div>
          <div className="fs-3 fw-semibold lh-1">
            {data.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km
          </div>
          <div className="text-muted small mt-1">Total Distance</div>
          <div className="text-muted small mt-1 fst-italic">{distanceFunFact(data.totalDistanceKm)}</div>
        </div>
        <div>
          <div className="fs-3 fw-semibold lh-1">
            {data.totalElevationM.toLocaleString(undefined, { maximumFractionDigits: 2 })} m
          </div>
          <div className="text-muted small mt-1">Total Elevation</div>
          <div className="text-muted small mt-1 fst-italic">{elevationFunFact(data.totalElevationM)}</div>
        </div>
      </div>

      <Tabs defaultActiveKey="teams" className="mb-4">
        <Tab eventKey="teams" title="Teams">
          <div className="pt-4" style={{ overflowX: "auto" }}>
            <Table responsive hover className="align-middle">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th className="text-center">Qualifiers</th>
                  <th>Distance</th>
                  <th className="text-end">Points</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr
                    key={team.teamId}
                    role="button"
                    style={{ cursor: "pointer" }}
                    className={team.teamId === selectedTeamId ? "table-active" : ""}
                    onClick={() => toggleTeam(team.teamId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {team.logoUrl ? (
                          <UserAvatar photoUrl={team.logoUrl} size={32} />
                        ) : (
                          <i className="bi bi-airplane text-success" aria-hidden />
                        )}
                        {team.teamName}
                      </div>
                    </td>
                    <td className="text-center">{team.qualifierCount}</td>
                    <td style={{ minWidth: 220 }}>
                      <div className="d-flex justify-content-between small mb-1">
                        <span>{team.qualifyingDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km</span>
                        <span className="text-muted">of {data.teamGoalKm.toLocaleString()} km</span>
                      </div>
                      <div className="progress" style={{ height: 6 }}>
                        <div
                          className={`progress-bar ${team.qualifies ? "bg-success" : ""}`}
                          style={{ width: `${Math.min(100, (team.qualifyingDistanceKm / data.teamGoalKm) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-end">
                      {team.qualifyingPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-center">
                      {team.qualifies ? (
                        <Badge bg="success" className="bg-opacity-10 text-success">
                          Qualified
                        </Badge>
                      ) : eventEnded ? null : (
                        <span className="text-muted small">In progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {selectedTeam && (
            <div className="pt-2 pb-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className="h6 fw-bold mb-0 d-flex align-items-center gap-2">
                  {selectedTeam.logoUrl ? (
                    <UserAvatar photoUrl={selectedTeam.logoUrl} size={24} />
                  ) : (
                    <i className="bi bi-airplane text-success" aria-hidden />
                  )}
                  {selectedTeam.teamName} — Members
                </h3>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setSelectedTeamId(null)} />
              </div>
              {selectedTeamMembers.length === 0 ? (
                <p className="text-muted mb-0">No riders on this team yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <Table size="sm" hover className="align-middle">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Rider</th>
                        <th className="text-end">Distance</th>
                        <th className="text-end">Points</th>
                        <th className="text-center">Medal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeamMembers.map((rider, index) => {
                        const medal = rider.medal ? MEDAL_BADGE[rider.medal] : null;
                        return (
                          <tr
                            key={rider.phone}
                            role="button"
                            style={{ cursor: "pointer" }}
                            onClick={() => openRider(rider.phone)}
                          >
                            <td>{index + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <UserAvatar photoUrl={rider.photoUrl} size={28} />
                                <div>
                                  <div className="text-primary">{rider.name}</div>
                                  <div className="text-muted" style={{ fontSize: 11 }}>
                                    {rider.city}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="text-end">
                              {rider.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km
                            </td>
                            <td className="text-end">{rider.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="text-center">
                              {medal ? <Badge className={medal.className}>{medal.label}</Badge> : <span className="text-muted">–</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  <p className="text-muted small mb-0">
                    Only the top {TOP_N_COUNTED_TOWARD_TEAM_GOAL} riders by distance count toward the team&apos;s{" "}
                    {data.teamGoalKm.toLocaleString()}km goal.
                  </p>
                </div>
              )}
            </div>
          )}
        </Tab>

        <Tab eventKey="individual" title="Individual">
          <div className="pt-4" style={{ overflowX: "auto" }}>
            <Table responsive hover className="align-middle">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Rider</th>
                  <th className="text-end">Distance</th>
                  <th className="text-end">Elevation</th>
                  <th className="text-end">Points</th>
                  <th className="text-center">Medal</th>
                </tr>
              </thead>
              <tbody>
                {visibleRiders.map((rider, index) => {
                  const medal = rider.medal ? MEDAL_BADGE[rider.medal] : null;
                  return (
                    <tr key={rider.phone} role="button" style={{ cursor: "pointer" }} onClick={() => openRider(rider.phone)}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <UserAvatar photoUrl={rider.photoUrl} size={32} />
                          <div>
                            <div className="text-primary">{rider.name}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {rider.teamName}
                              {rider.city ? ` · ${rider.city}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-end">
                        {rider.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km
                      </td>
                      <td className="text-end">
                        {rider.totalElevationM.toLocaleString(undefined, { maximumFractionDigits: 2 })} m
                      </td>
                      <td className="text-end">{rider.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="text-center">
                        {medal ? <Badge className={medal.className}>{medal.label}</Badge> : <span className="text-muted">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {visibleCount < riders.length && (
              <div ref={sentinelRef} className="text-center text-muted small py-3">
                Loading more riders…
              </div>
            )}
            <div className="text-center text-muted small py-2">
              Showing {visibleRiders.length} of {riders.length} riders
            </div>
          </div>
        </Tab>

        <Tab eventKey="top" title="Top Performers">
          <div className="pt-4 d-flex flex-wrap gap-4">
            <RiderList title="Top Male Riders (Distance)" riders={topMaleByDistance} unit="distance" />
            <RiderList title="Top Female Riders (Distance)" riders={topFemaleByDistance} unit="distance" />
            <RiderList title="Top Male Riders (Elevation)" riders={topMaleByElevation} unit="elevation" />
            <RiderList title="Top Female Riders (Elevation)" riders={topFemaleByElevation} unit="elevation" />
          </div>
        </Tab>
      </Tabs>

      <Modal show={selectedRider !== null} onHide={close} centered size="lg">
        <ModalHeader closeButton>
          <ModalTitle>{selectedRider?.name}&apos;s Rides</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {loading && <p className="text-muted mb-0">Loading rides…</p>}
          {!loading && rides && rides.length === 0 && <p className="text-muted mb-0">No rides found.</p>}
          {!loading && rides && rides.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <Table size="sm" hover>
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="text-end">Distance</th>
                    <th className="text-end">Elevation</th>
                    <th className="text-end">Points</th>
                    <th>Status</th>
                    <th className="text-center">Strava</th>
                  </tr>
                </thead>
                <tbody>
                  {rides.map((ride, index) => (
                    <tr key={ride.activityId} className={ride.counted ? "" : "text-muted"}>
                      <td>{index + 1}</td>
                      <td className="text-nowrap">
                        {new Date(ride.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td>{ride.type}</td>
                      <td className="text-end">{ride.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km</td>
                      <td className="text-end">{ride.elevationM.toLocaleString(undefined, { maximumFractionDigits: 2 })} m</td>
                      <td className="text-end">{ride.points.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>
                        {ride.counted ? (
                          <Badge bg="success" className="bg-opacity-10 text-success">
                            Counted
                          </Badge>
                        ) : (
                          <span title={ride.exclusionReason ?? undefined}>
                            <Badge bg="danger" className="bg-opacity-10 text-danger">
                              Excluded
                            </Badge>
                            <div className="small text-muted mt-1" style={{ maxWidth: 220 }}>
                              {ride.exclusionReason}
                            </div>
                          </span>
                        )}
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
          )}
        </ModalBody>
      </Modal>
    </div>
  );
}
