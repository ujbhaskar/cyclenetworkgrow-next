"use client";

import { useState } from "react";
import type { DailyRideCount } from "@/lib/admin-dashboard-stats";

const BAR_COLOR = "#125ea3"; // $cng-blue-color (globals.scss) — validated via dataviz's palette script
const CHART_HEIGHT = 140;

function formatDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
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

// Single-series magnitude-over-time bar chart — no legend (one color, the
// title says what it is); the count is direct-labeled above every bar so
// the value is always visible, not gated behind hover. Hover/focus just
// adds the full date in a tooltip and a slight lift on that bar.
export default function RidesPerDayChart({ data }: { data: DailyRideCount[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="position-relative">
      <div
        className="d-flex align-items-end"
        style={{ height: CHART_HEIGHT, gap: 16, borderBottom: "1px solid #e5e5e5" }}
      >
        {data.map((point, index) => {
          const heightPx = point.count === 0 ? 0 : Math.max((point.count / max) * (CHART_HEIGHT - 24), 4);
          const isActive = activeIndex === index;
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
              aria-label={`${formatFullDate(point.day)}: ${point.count} ride${point.count === 1 ? "" : "s"}`}
            >
              {isActive && (
                <div
                  className="position-absolute bg-dark text-white small px-2 py-1 rounded text-nowrap"
                  style={{ bottom: heightPx + 28, zIndex: 2, pointerEvents: "none" }}
                >
                  {formatFullDate(point.day)}: {point.count} ride{point.count === 1 ? "" : "s"}
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
                  background: BAR_COLOR,
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
