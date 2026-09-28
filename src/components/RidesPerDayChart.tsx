"use client";

import { useState } from "react";

const BAR_COLOR = "#125ea3"; // $cng-blue-color (globals.scss)
const PEAK_COLOR = "#4caf6d"; // $cng-brand-green (globals.scss)
// Both validated via dataviz's palette script: CVD ΔE 28.2 (protan)/18.9
// (tritan), normal-vision ΔE 28.6 — clearly distinct as a base+highlight
// pair. The green's own contrast-vs-surface WARNs below 3:1, which is why
// every bar (peak or not) carries its count as a plain-ink direct label
// rather than relying on the bar's fill to read the value.
const CHART_HEIGHT = 140;

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  return `${ordinal(d)} ${month}`;
}

function formatFullDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export type DailyCountPoint = { day: string; count: number };

// Single-series magnitude-over-time bar chart — no legend (one color, the
// title says what it is); the count is direct-labeled above every bar so
// the value is always visible, not gated behind hover. Hover/focus just
// adds the full date in a tooltip and a slight lift on that bar.
// `highlightPeak` colors the single highest-count bar as a called-out
// extreme (not a series/identity distinction — only ever one bar at a
// time), matching the "label the extreme" pattern for direct labels.
export default function RidesPerDayChart({
  data,
  highlightPeak = false,
}: {
  data: DailyCountPoint[];
  highlightPeak?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const peakIndex = highlightPeak && max > 0 ? data.findIndex((d) => d.count === max) : -1;

  return (
    // paddingTop reserves headroom for the tallest bar's tooltip (which
    // floats above the bar, and the tallest bar leaves the least room) —
    // self-contained so it can never poke into whatever a caller renders
    // above this chart, regardless of the tooltip's own rendered height.
    <div className="position-relative" style={{ paddingTop: 48 }}>
      <div
        className="d-flex align-items-end"
        style={{ height: CHART_HEIGHT, gap: 16, borderBottom: "1px solid #e5e5e5" }}
      >
        {data.map((point, index) => {
          const heightPx = point.count === 0 ? 0 : Math.max((point.count / max) * (CHART_HEIGHT - 24), 4);
          const isActive = activeIndex === index;
          const isPeak = index === peakIndex;
          return (
            <div
              key={point.day}
              className="d-flex flex-column align-items-center justify-content-end flex-fill"
              style={{ height: CHART_HEIGHT, position: "relative" }}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              tabIndex={0}
              role="img"
              aria-label={`${formatFullDate(point.day)}: ${point.count} ride${point.count === 1 ? "" : "s"}${isPeak ? " (busiest day)" : ""}`}
            >
              {isActive && (
                <div
                  className="position-absolute bg-dark text-white small px-2 py-1 rounded text-nowrap"
                  style={{ bottom: heightPx + 28, zIndex: 2, pointerEvents: "none" }}
                >
                  {formatFullDate(point.day)}: {point.count} ride{point.count === 1 ? "" : "s"}
                  {isPeak ? " · busiest day" : ""}
                </div>
              )}
              <div className="small text-muted mb-1" style={{ fontVariantNumeric: "tabular-nums" }}>
                {point.count}
              </div>
              <div
                style={{
                  width: 24,
                  maxWidth: 24,
                  height: heightPx,
                  background: isPeak ? PEAK_COLOR : BAR_COLOR,
                  opacity: isActive ? 0.85 : 1,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  transition: "opacity 0.15s ease",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="d-flex" style={{ gap: 16 }}>
        {data.map((point) => (
          <div key={point.day} className="text-muted small text-center flex-fill">
            {formatDayLabel(point.day)}
          </div>
        ))}
      </div>
    </div>
  );
}
