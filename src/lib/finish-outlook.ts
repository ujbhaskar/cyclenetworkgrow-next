import "server-only";
import { getEventDayNumber, isEventNotYetStarted } from "@/lib/events";
import type { EventCard } from "@/lib/models/event";
import { buildFinishOutlook, type FinishOutlook } from "@/lib/models/finish-outlook";
import { MILESTONE_QUOTAS, type RiderMetric } from "@/lib/models/rider-metric";
import { istDayKey } from "@/lib/rider-metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many riders can still complete the 1177 event: it runs `totalDays` days,
 * `mandatoryDays` of them need a qualifying ride (the sum of the bracket quotas
 * — 1+3+6+15+30 = 55) and the rest are excuse days. Built from the leaderboard's
 * own riders (the same ones the event page already loaded), so the numbers always
 * agree with the table. Null before the event starts — nothing to project yet.
 */
export function buildEventFinishOutlook(event: EventCard, leaderboardRiders: RiderMetric[]): FinishOutlook | null {
  if (isEventNotYetStarted(event)) return null;

  const totalDays =
    Math.round((Date.parse(event.endDate.slice(0, 10)) - Date.parse(event.startDate.slice(0, 10))) / DAY_MS) + 1;
  const mandatoryDays = Object.values(MILESTONE_QUOTAS).reduce((sum, n) => sum + n, 0);
  const todayKey = istDayKey(new Date().toISOString());

  return buildFinishOutlook({
    dayNumber: getEventDayNumber(event),
    totalDays,
    mandatoryDays,
    riders: leaderboardRiders.map((rider) => ({
      phone: rider.phone,
      name: rider.name,
      city: rider.city,
      state: rider.state,
      // totalsByDay has one entry per IST day with a qualifying ride (same-day
      // rides are already collapsed to the longest), so its size is the days ridden —
      // the same number as the table's "Total Rides".
      daysRidden: Object.keys(rider.totalsByDay).length,
      rodeToday: todayKey in rider.totalsByDay,
    })),
  });
}
