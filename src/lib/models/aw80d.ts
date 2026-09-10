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
  // Rules §6b: only the top 20 riders' distance counts toward the team
  // total, regardless of team size.
  qualifyingDistanceKm: number;
  totalDistanceKm: number;
  qualifies: boolean;
};

export type Aw80dLeaderboardData = {
  teams: Aw80dTeam[];
  riders: Aw80dRider[];
  topMaleByDistance: Aw80dRider[];
  topFemaleByDistance: Aw80dRider[];
  topMaleByElevation: Aw80dRider[];
  topFemaleByElevation: Aw80dRider[];
  finisherCount: number;
  totalDistanceKm: number;
  totalElevationM: number;
  teamGoalKm: number;
  finisherTargetKm: number;
};
