// Admin-configurable ride-qualification thresholds — previously hardcoded
// per-file (aw80d.ts's MIN_RIDE_KM/MAX_ELAPSED_TO_MOVING_RATIO, the "> 3"
// red-highlight check duplicated in MissingRidesPanel.tsx/
// RideFlaggingPanel.tsx). One shared config admins can tune without a code
// change, surfaced at /admin/rides/rules.

export type RideRulesConfig = {
  // A ride's elapsed time can't exceed this multiple of its moving time
  // (rules §7d) — above it, the ride is flagged as likely "mostly
  // stopped, not actually riding."
  elapsedToMovingRatioMax: number;
  // Rides shorter than this don't qualify at all (rules §6h/7e).
  minRideDistanceKm: number;
  // A single virtual/trainer ride longer than this is flagged for review.
  maxVirtualRideDistanceKm: number;
  // Default "Activities After" date (YYYY-MM-DD) pre-filled on the Pull
  // Missing Rides page — was hardcoded in MissingRidesPanel.tsx before this
  // field existed.
  missingRidesDefaultAfterDate: string;
};

export const DEFAULT_RIDE_RULES: RideRulesConfig = {
  elapsedToMovingRatioMax: 3,
  minRideDistanceKm: 20,
  maxVirtualRideDistanceKm: 100,
  missingRidesDefaultAfterDate: "2026-04-03",
};
