// Firestore's legacy `rides`/activity documents store numeric fields
// (distance, elevation, elapsed/moving time) inconsistently as either a
// real number or a numeric string, depending on which write path produced
// them (the Strava webhook vs. the old Angular admin's manual entry
// tools) — this normalizes either into a real number, defaulting
// unparseable/missing values to 0 rather than throwing. Shared by
// rider-metrics.ts (1177) and aw80d.ts (AW80D), the two places that read
// this loosely-typed activity data. No server-only import — plain
// arithmetic, safe from either side.
export function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
