"use client";

import { useState } from "react";
import indiaStatesGeo from "@/lib/geo/india-states-paths.json";
import type { PlaceStat } from "@/lib/models/rider-metric";

// Our canonical state names (see normalizeIndianState in src/lib/india-states.ts)
// mostly match this map's feature names, except two that use "&" here.
const MAP_FEATURE_NAME_OVERRIDES: Record<string, string> = {
  "Jammu and Kashmir": "Jammu & Kashmir",
  "Andaman and Nicobar Islands": "Andaman & Nicobar",
};

// A ranked bar-list already covers city/state stats reliably. This map is
// a visual complement to it, built from real (simplified) state boundary
// geometry — not a stand-in for the ranking, since a handful of riders'
// free-text state values don't normalize to a state at all and simply
// won't be shaded here.
//
// Boundary source: datameet/maps (github.com/datameet/maps), an Indian
// open-data project — used instead of the more common GADM dataset because
// GADM crops Jammu & Kashmir at the Line of Control, omitting
// Pakistan-occupied Kashmir and Aksai Chin. datameet's data reflects
// India's full territorial claim (verified: J&K+Ladakh here spans
// 72.5–80.3°E/32.3–37.1°N vs GADM's 73.8–79.6°E/32.3–35.5°N).
export default function IndiaStateMap({ stats }: { stats: PlaceStat[] }) {
  const [hovered, setHovered] = useState<PlaceStat | null>(null);

  const statsByMapName = new Map<string, PlaceStat>();
  stats.forEach((stat) => {
    statsByMapName.set(MAP_FEATURE_NAME_OVERRIDES[stat.place] ?? stat.place, stat);
  });

  const maxDistance = Math.max(1, ...stats.map((s) => s.totalDistanceKm));

  return (
    <div className="flex-grow-1" style={{ minWidth: 280, maxWidth: 420 }}>
      <h3 className="h6 fw-bold mb-3">
        <i className="bi bi-map-fill me-2" aria-hidden />
        Where Riders Are From
      </h3>
      <style>{`
        .india-map-path { stroke: #fff; stroke-width: 0.6; transition: opacity 0.15s; cursor: default; }
        .india-map-path:hover { opacity: 0.75; stroke-width: 1.2; }
      `}</style>
      <svg
        viewBox={`0 0 ${indiaStatesGeo.width} ${indiaStatesGeo.height}`}
        role="img"
        aria-label="Map of India shaded by rider distance per state"
        style={{ width: "100%", height: "auto" }}
      >
        {indiaStatesGeo.states.map((state) => {
          const stat = statsByMapName.get(state.name);
          const intensity = stat ? 0.15 + 0.85 * (stat.totalDistanceKm / maxDistance) : 0;
          const fill = stat ? `rgba(25, 135, 84, ${intensity.toFixed(2)})` : "#e9ecef";
          return (
            <path
              key={state.name}
              d={state.d}
              className="india-map-path"
              fill={fill}
              onMouseEnter={() => stat && setHovered(stat)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>
                {stat
                  ? `${stat.place}: ${stat.riderCount} rider${stat.riderCount === 1 ? "" : "s"}, ${stat.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`
                  : state.name}
              </title>
            </path>
          );
        })}
      </svg>
      <div className="text-muted small mt-2" style={{ minHeight: 20 }}>
        {hovered ? (
          <>
            <strong>{hovered.place}</strong> — {hovered.riderCount} rider{hovered.riderCount === 1 ? "" : "s"},{" "}
            {hovered.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
          </>
        ) : (
          "Hover a state for details. Darker = more distance covered."
        )}
      </div>
    </div>
  );
}
