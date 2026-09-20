// Types/constants shared between the server-only data layer
// (src/lib/rider-metrics.ts) and client components (the leaderboard table
// and its "verify rides" modal). Kept in a plain module — no `server-only`
// import here — since a client component pulling in a runtime value (like
// MILESTONES_KM) from a server-only module would break the build.

// Randonneuring-style qualifying brackets, matching the legacy portal's
// event leaderboard (letscng.com/cng-events/1177-2024). Each ride counts
// toward exactly one bracket, assigned by a top-down waterfall against the
// event's quota per bracket (see MILESTONE_QUOTAS in rider-metrics.ts): a
// ride first fills the highest bracket it still qualifies for and has
// quota remaining in, and only spills down to the next bracket once that
// quota's full — so a rider's bracket counts always sum to their total
// qualifying ride count. Rides under the smallest milestone (25km) don't
// qualify at all, same as the legacy scoring.
export const MILESTONES_KM = [25, 50, 75, 100, 150] as const;
export type MilestoneKm = (typeof MILESTONES_KM)[number];

// Minimum qualifying-ride count the event asks for at each bracket (55
// rides total: 1x150 + 3x100 + 6x75 + 15x50 + 30x25). A rider's
// milestoneCounts[m] >= MILESTONE_QUOTAS[m] means that specific bracket's
// quota is met — shown as a green cell in the leaderboard table.
export const MILESTONE_QUOTAS: Record<MilestoneKm, number> = { 150: 1, 100: 3, 75: 6, 50: 15, 25: 30 };

export type QualifyingRide = {
  activityId: string;
  distanceKm: number;
  elevationM: number;
  type: string;
  startDate: string;
  bracket: MilestoneKm | null;
  // Strava's VirtualRide type, or a trainer-flagged outdoor-type Ride —
  // either way, rules §6(d)'s "Indoor Ride Adjustment" (75% points) applies.
  isVirtual: boolean;
  // This one ride's own contribution to the rider's total points — rules
  // §6(a)/(d): floor(distanceKm / 25), ×0.75 if isVirtual. Per-ride so the
  // "verify rides" modal can show exactly how each ride contributed.
  points: number;
};

export type RiderMetric = {
  phone: string;
  name: string;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
  milestoneCounts: Record<MilestoneKm, number>;
  // Per-bracket: milestoneCounts[m] >= MILESTONE_QUOTAS[m] — that single
  // bracket's quota met, independent of the others (unlike isFinisher,
  // which requires every bracket met at once).
  milestoneAchieved: Record<MilestoneKm, boolean>;
  totalRides: number;
  totalDistanceKm: number;
  isFinisher: boolean;
  progressPercent: number | null;
  // Rules §6's actual point-ranking system (distinct from the
  // milestone-bracket qualification above, which only gates medals/
  // certificates per §5(e)). distancePoints is §6(a)/(d) — sum of each
  // qualifying day's floor(km/25), ×0.75 if indoor. bonusPoints is
  // §6(b)/(c) — the Consistency/Endurance streak bonuses. totalPoints is
  // their sum, and what the leaderboard is actually ranked by.
  distancePoints: number;
  bonusPoints: number;
  totalPoints: number;
};

export type LongestRide = {
  activityId: string;
  riderName: string;
  city: string | null;
  distanceKm: number;
  startDate: string;
};

export type PlaceStat = {
  place: string;
  riderCount: number;
  totalDistanceKm: number;
};

export type GenderStat = {
  riderCount: number;
  totalDistanceKm: number;
};

export type EventLeaderboardData = {
  riders: RiderMetric[];
  totalQualifiers: number;
  totalDistanceKm: number;
  totalRides: number;
  finisherCount: number;
  longestRide: LongestRide | null;
  maleLongestRide: LongestRide | null;
  femaleLongestRide: LongestRide | null;
  topCities: PlaceStat[];
  topStates: PlaceStat[];
  allStateStats: PlaceStat[];
  bracketTotals: Record<MilestoneKm, number>;
  genderStats: { male: GenderStat; female: GenderStat };
};
