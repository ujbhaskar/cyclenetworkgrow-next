// AW80D (Around The World In 80 Days) is structurally unrelated to the
// 1177-style milestone-bracket events — see the event's own rules PDF
// ("CNG AW80D 2026 Concept Note_v3_15th March.pdf", linked from its Rules
// button). Team-based, single 1500km individual finisher target, and a
// points system (distance + elevation, elevation capped at 1.75x distance)
// driving Gold/Silver/Bronze medals. No server-only import here — shared
// between the server data layer and client components.

export type Aw80dMedal = "gold" | "silver" | "bronze" | null;

export type Aw80dRider = {
  phone: string;
  name: string;
  gender: "Male" | "Female" | null;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
  teamId: string;
  teamName: string;
  totalRides: number;
  totalDistanceKm: number;
  totalElevationM: number;
  distancePoints: number;
  elevationPoints: number;
  totalPoints: number;
  isFinisher: boolean;
  medal: Aw80dMedal;
};

export type Aw80dTeam = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  memberCount: number;
  // Rules §6b/§9: only the top 20 riders — ranked by points, same as the
  // individual leaderboard — count toward both the team's distance goal and
  // its points total, regardless of team size.
  qualifyingDistanceKm: number;
  qualifyingPoints: number;
  totalDistanceKm: number;
  qualifies: boolean;
  // Individual finishers (§6c.i, 1500km+) on this team — independent of
  // whether the team itself qualifies (§6e).
  qualifierCount: number;
};

// Every ride a rider synced within the event window, for the "verify
// rides" audit view — unlike the leaderboard totals, this includes rides
// that don't count (e.g. failed the §7d elapsed/moving-time check), each
// annotated with why, so riders/captains can see exactly what was excluded
// and why their total doesn't match the raw Strava feed.
export type Aw80dVerificationRide = {
  activityId: string;
  distanceKm: number;
  elevationM: number;
  type: string;
  startDate: string;
  points: number;
  counted: boolean;
  exclusionReason: string | null;
};

export type Aw80dLeaderboardData = {
  teams: Aw80dTeam[];
  riders: Aw80dRider[];
  topMaleByDistance: Aw80dRider[];
  topFemaleByDistance: Aw80dRider[];
  topMaleByElevation: Aw80dRider[];
  topFemaleByElevation: Aw80dRider[];
  finisherCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  totalDistanceKm: number;
  totalElevationM: number;
  teamGoalKm: number;
  finisherTargetKm: number;
};
