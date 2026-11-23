// "Who can still finish?" for an event with a fixed number of mandatory riding
// days inside a longer window — pure arithmetic, no server imports, so the
// admin table (client) and the loader (server) share one definition.
//
// Rule (1177: 77-day event, 55 mandatory riding days => 22 excuse days):
//   on day N, a rider can still finish if they've already ridden at least
//   N - excuseDays qualifying days. Today counts as "missed" until the rider
//   has ridden today, so the rule is deliberately on the strict side.

export type OutlookStatus = "completed" | "possible" | "out";

export type OutlookRiderInput = {
  phone: string;
  name: string;
  city: string | null;
  state: string | null;
  /** Qualifying riding days so far — one per IST day with a qualifying ride. */
  daysRidden: number;
  rodeToday: boolean;
};

export type OutlookRider = OutlookRiderInput & {
  /** Days of the event so far (including today) the rider has no qualifying ride for. */
  daysMissed: number;
  /** Excuse days the rider still has; 0 means no slack left, negative means they're past it. */
  excuseDaysLeft: number;
  /** Riding days still needed to reach the mandatory total. */
  daysStillNeeded: number;
  status: OutlookStatus;
};

export type FinishOutlook = {
  /** Which day of the event today is (1-indexed, clamped to the event's span). */
  dayNumber: number;
  totalDays: number;
  mandatoryDays: number;
  excuseDays: number;
  /** Days after today that are still to come. */
  daysLeft: number;
  /** Riding days a rider needs by now to still be in the running. */
  minimumDaysNow: number;
  counts: { registered: number; riding: number; completed: number; possible: number; out: number };
  riders: OutlookRider[];
};

export function buildFinishOutlook(input: {
  riders: OutlookRiderInput[];
  dayNumber: number;
  totalDays: number;
  mandatoryDays: number;
}): FinishOutlook {
  const { dayNumber, totalDays, mandatoryDays } = input;
  const excuseDays = Math.max(0, totalDays - mandatoryDays);
  const minimumDaysNow = Math.max(0, dayNumber - excuseDays);

  const riders: OutlookRider[] = input.riders.map((rider) => {
    const daysMissed = Math.max(0, dayNumber - rider.daysRidden);
    const status: OutlookStatus =
      rider.daysRidden >= mandatoryDays ? "completed" : rider.daysRidden >= minimumDaysNow ? "possible" : "out";
    return {
      ...rider,
      daysMissed,
      excuseDaysLeft: excuseDays - daysMissed,
      daysStillNeeded: Math.max(0, mandatoryDays - rider.daysRidden),
      status,
    };
  });

  // Most days ridden first; within that, the ones with the least slack on top.
  riders.sort((a, b) => b.daysRidden - a.daysRidden || a.name.localeCompare(b.name));

  const countOf = (s: OutlookStatus) => riders.filter((r) => r.status === s).length;
  return {
    dayNumber,
    totalDays,
    mandatoryDays,
    excuseDays,
    daysLeft: Math.max(0, totalDays - dayNumber),
    minimumDaysNow,
    counts: {
      registered: riders.length,
      riding: riders.filter((r) => r.daysRidden > 0).length,
      completed: countOf("completed"),
      // "Possible finishers" includes those who've already completed.
      possible: countOf("possible") + countOf("completed"),
      out: countOf("out"),
    },
    riders,
  };
}
