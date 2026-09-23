"use client";

import { useMemo, useState } from "react";
import Form from "react-bootstrap/Form";
import type { EventDailyProgressData } from "@/lib/models/rider-metric";

// "29 Sep" from a bare IST day key ("2026-09-29") — built via Date.UTC and
// displayed with timeZone: "UTC" so the shown day never drifts off the key
// itself regardless of the viewer's or server's local timezone (the same
// class of bug fixed in events.ts/rider-metrics.ts for the event window
// itself — worth being deliberate about here too).
function formatDayHeader(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Rider × IST-day distance matrix — every cell is that rider's one
// qualifying ride for the day (1177 rules §5(f)-(h)/§8(b): never more than
// one), linking straight to the Strava activity that produced it. Newest
// day first, since "did I ride today/yesterday" is what a rider actually
// scans for, not the event's first day.
export default function EventDailyProgressTable({ data }: { data: EventDailyProgressData }) {
  const { days, riders } = data;
  const [nameFilter, setNameFilter] = useState("");

  // Rank reflects each rider's position in the event's actual (unfiltered)
  // standing — data.riders arrives pre-sorted by distance — so it stays
  // fixed as the admin types into the search box rather than shifting
  // around as the visible rows change.
  const rankedRiders = useMemo(() => riders.map((rider, index) => ({ rider, rank: index + 1 })), [riders]);

  const visibleRiders = useMemo(() => {
    const query = nameFilter.trim().toLowerCase();
    if (!query) return rankedRiders;
    return rankedRiders.filter(({ rider }) => rider.name.toLowerCase().includes(query));
  }, [rankedRiders, nameFilter]);

  if (riders.length === 0) {
    return <p className="text-muted">No qualifying rides yet — check back once the event is underway.</p>;
  }

  const dayTotals = days.map((day) =>
    riders.reduce((sum, rider) => sum + (rider.totalsByDay[day]?.distanceKm ?? 0), 0),
  );

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-2">
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
        <span className="text-muted small ms-auto">
          {visibleRiders.length} of {riders.length} riders
        </span>
      </div>
      <div className="cng-daily-scroll">
        {/* Same sticky-header/sticky-first-column pattern as the main
            leaderboard table (see EventLeaderboard.tsx) — this matrix is
            wider still (one column per event day), so it matters even more
            here on mobile. */}
        <style>{`
          .cng-daily-scroll { overflow: auto; max-height: 70vh; overscroll-behavior: contain; }
          .cng-daily-scroll table thead th { position: sticky; top: 0; z-index: 2; background: #fff; }
          .cng-daily-scroll table .col-rank,
          .cng-daily-scroll table .col-name { position: sticky; z-index: 1; background: #fff; }
          .cng-daily-scroll table .col-rank { left: 0; width: 42px; }
          .cng-daily-scroll table .col-name {
            left: 42px;
            box-shadow: 2px 0 4px -2px rgba(0,0,0,0.15);
            min-width: 140px;
          }
          .cng-daily-scroll table thead th.col-rank,
          .cng-daily-scroll table thead th.col-name { z-index: 3; }
          .cng-daily-scroll table td, .cng-daily-scroll table th { white-space: nowrap; }
        `}</style>
        <table className="table table-hover table-sm align-middle mb-0">
          <thead>
            <tr>
              <th className="col-rank">Rank</th>
              <th className="col-name">Rider</th>
              {days.map((day) => (
                <th key={day} className="text-end">
                  {formatDayHeader(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRiders.map(({ rider, rank }) => (
              <tr key={rider.phone}>
                <td className="col-rank">{rank}</td>
                <td className="col-name">{rider.name}</td>
                {days.map((day) => {
                  const cell = rider.totalsByDay[day];
                  return (
                    <td key={day} className="text-end">
                      {cell ? (
                        <a
                          href={`https://www.strava.com/activities/${cell.activityId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View this ride on Strava"
                        >
                          {cell.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </a>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-bold">
              <td className="col-rank" />
              <td className="col-name">Total</td>
              {dayTotals.map((total, index) => (
                <td key={days[index]} className="text-end">
                  {total > 0 ? total.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "–"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
