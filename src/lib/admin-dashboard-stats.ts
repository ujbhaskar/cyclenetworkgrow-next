import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { istDayKey } from "@/lib/rider-metrics";

const RIDES_COLLECTION = "rides";

export type DailyRideCount = { day: string; count: number };

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

/**
 * Site-wide ride counts per IST calendar day for the last `days` days
 * (oldest first) — a full scan of the `rides` collection, not scoped to
 * any one event. Small today (a few hundred activities across ~90 riders),
 * so this isn't cached like the per-event leaderboard — it's an
 * infrequently-viewed admin dashboard stat, not a public page under load.
 */
export async function getRecentDailyRideCounts(days = 7): Promise<DailyRideCount[]> {
  const snapshot = await adminDb.collection(RIDES_COLLECTION).get();

  const counts = new Map<string, number>();
  snapshot.forEach((doc) => {
    const activities = doc.data() as Record<string, { start_date?: string }>;
    Object.values(activities).forEach((activity) => {
      if (!activity.start_date) return;
      const day = istDayKey(activity.start_date);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    });
  });

  const today = istDayKey(new Date().toISOString());
  const result: DailyRideCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDayKey(today, -i);
    result.push({ day, count: counts.get(day) ?? 0 });
  }
  return result;
}
