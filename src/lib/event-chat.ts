import "server-only";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { EventCard } from "@/lib/models/event";
import { MILESTONES_KM, MILESTONE_QUOTAS, type EventLeaderboardData, type RiderMetric } from "@/lib/models/rider-metric";
import { normalizeCity } from "@/lib/registration-normalize";
import { getRideRulesConfig } from "@/lib/ride-rules";
import { istDayKey } from "@/lib/rider-metrics";

export type EventChatToolName =
  | "get_event_summary"
  | "get_leaderboard_top"
  | "get_my_standing"
  | "get_rider_standing"
  | "get_top_rider_for_day"
  | "get_city_stats"
  | "get_event_rules";

// Tool definitions in OpenAI's function-calling schema — kept deliberately
// narrow (one job each) rather than one big "query the database" tool, so
// the model can't wander outside data we've actually computed/verified and
// the bot can't be talked into guessing at eligibility edge cases.
export const EVENT_CHAT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_event_summary",
      description:
        "Overview stats for the event: name, date range, total qualifying riders, total distance ridden, total rides, and how many riders have finished (met every milestone quota). Use this for general 'how's the event going' questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leaderboard_top",
      description:
        "Top-ranked riders overall, sorted by the event's actual ranking rule (points first, then total km, then name). Use for 'who's leading', 'top riders', 'who has the most points' type questions.",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "How many riders to return, default 10, max 50." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_standing",
      description:
        "The signed-in rider's OWN rank, points, total distance, ride count, and city — already knows who they are from their session, no name needed. Always use this (never get_rider_standing, and never ask them to type their name) for 'my progress', 'my rank', 'how am I doing', 'where do I stand' type questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rider_standing",
      description:
        "Look up one specific OTHER rider by name (partial/case-insensitive match) and return their rank, points, total distance, ride count, and city. Use only for a named person, e.g. 'how is Ramkumar doing' — for the signed-in rider asking about themselves, use get_my_standing instead.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full or partial rider name to search for." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_rider_for_day",
      description:
        "The rider(s) with the longest qualifying ride on one specific IST calendar day — use for 'who rode the most today/yesterday/on <date>' questions. Only one ride counts per rider per day (the day's longest), matching the event's own rules.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "'today', 'yesterday', or an explicit IST date as YYYY-MM-DD. Defaults to 'today'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_city_stats",
      description:
        "Rider count and total distance for a specific city, or the top cities overall if no city is given. Use for 'how many riders from <city>' or 'which city has the most riders' questions.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name to look up. Omit to get the top cities overall." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_rules",
      description:
        "The event's actual qualification and ranking rules — ride distance/type requirements, points formula, bonus points, and ranking tiebreakers. Use for any question about criteria, eligibility, how points/ranking work, or what counts as a qualifying ride.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function riderSummary(rider: RiderMetric, rank: number) {
  return {
    rank,
    name: rider.name,
    city: rider.city,
    state: rider.state,
    totalPoints: rider.totalPoints,
    totalDistanceKm: Math.round(rider.totalDistanceKm),
    totalRides: rider.totalRides,
    isFinisher: rider.isFinisher,
    // Progress toward the finisher medal/certificate quota (see
    // get_event_rules) — completed/required rides per distance bracket.
    milestoneProgress: MILESTONES_KM.map((km) => ({
      distanceKm: km,
      required: MILESTONE_QUOTAS[km],
      completed: rider.milestoneCounts[km],
      achieved: rider.milestoneAchieved[km],
    })),
  };
}

function resolveDayKey(date: string | undefined): { key: string; label: string } {
  const now = new Date();
  if (!date || date.toLowerCase() === "today") {
    return { key: istDayKey(now.toISOString()), label: "today" };
  }
  if (date.toLowerCase() === "yesterday") {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { key: istDayKey(y.toISOString()), label: "yesterday" };
  }
  return { key: date, label: date };
}

// Grounded directly in the actual verified implementation (rider-metrics.ts
// and ride-rules.ts) — never left to the model to guess or paraphrase from
// the rules PDF, which the bot never reads.
async function buildRulesSummary(): Promise<string> {
  const rules = await getRideRulesConfig();
  return [
    `Ranking: riders are ranked by total points (highest first). Ties are broken by total qualifying distance (km), then by name.`,
    `Points: a qualifying ride earns 1 point per 25km completed (rounded down). An indoor/virtual (or trainer-flagged) ride earns only 75% of that.`,
    `Bonus points: +1 for every complete run of 7 consecutive qualifying days (non-overlapping), plus +7 extra if a single streak reaches 77 consecutive days.`,
    `Only one ride counts per rider per calendar day (IST) — the day's longest qualifying ride.`,
    `A ride must both start and finish within the event's date window (IST) to qualify.`,
    `Minimum distance to qualify: ${rules.minRideDistanceKm}km.`,
    `A ride's elapsed time can't exceed ${rules.elapsedToMovingRatioMax}x its moving time, or it's excluded as likely not actually ridden.`,
    `Finisher medal/certificate (separate from rank — doesn't affect points or leaderboard position): requires at least ${MILESTONE_QUOTAS[150]} ride(s) of 150km+, ${MILESTONE_QUOTAS[100]} of 100km+, ${MILESTONE_QUOTAS[75]} of 75km+, ${MILESTONE_QUOTAS[50]} of 50km+, and ${MILESTONE_QUOTAS[25]} of 25km+ — ${MILESTONES_KM.reduce((sum, km) => sum + MILESTONE_QUOTAS[km], 0)} qualifying rides in total. Each qualifying ride counts toward the highest bracket it still has quota remaining in, so a rider's bracket counts always add up to their total qualifying ride count.`,
  ].join("\n");
}

/**
 * Executes one tool call against an already-fetched leaderboard snapshot —
 * no Firestore hits here beyond get_event_rules' config lookup, since the
 * caller already paid for getEventLeaderboard's (cached) computation.
 *
 * `currentPhone` is resolved server-side from the caller's own session
 * (never supplied by the model as a tool argument) — it's what lets
 * get_my_standing answer "my progress" without ever asking the rider who
 * they are.
 */
export async function runEventChatTool(
  name: EventChatToolName,
  input: Record<string, unknown>,
  event: EventCard,
  leaderboard: EventLeaderboardData,
  currentPhone: string | null,
): Promise<unknown> {
  switch (name) {
    case "get_my_standing": {
      if (!currentPhone) {
        return { found: false, message: "No phone number on file for this account, so standing can't be looked up." };
      }
      const index = leaderboard.riders.findIndex((rider) => rider.phone === currentPhone);
      if (index === -1) {
        return {
          found: false,
          message: "No qualifying rides recorded yet for this rider — nothing to show until their first qualifying ride syncs from Strava.",
        };
      }
      return { found: true, standing: riderSummary(leaderboard.riders[index], index + 1) };
    }

    case "get_event_summary":
      return {
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        totalQualifiers: leaderboard.totalQualifiers,
        totalDistanceKm: Math.round(leaderboard.totalDistanceKm),
        totalRides: leaderboard.totalRides,
        finisherCount: leaderboard.finisherCount,
      };

    case "get_leaderboard_top": {
      const count = Math.min(Math.max(Number(input.count) || 10, 1), 50);
      return leaderboard.riders.slice(0, count).map((rider, i) => riderSummary(rider, i + 1));
    }

    case "get_rider_standing": {
      const query = String(input.name ?? "").trim().toLowerCase();
      if (!query) {
        return { error: "No name given" };
      }
      const matches = leaderboard.riders
        .map((rider, i) => ({ rider, rank: i + 1 }))
        .filter(({ rider }) => rider.name.toLowerCase().includes(query));
      if (matches.length === 0) {
        return { found: false, message: `No rider matching "${input.name}" found in this event's qualifiers.` };
      }
      return { found: true, matches: matches.slice(0, 10).map(({ rider, rank }) => riderSummary(rider, rank)) };
    }

    case "get_top_rider_for_day": {
      const { key, label } = resolveDayKey(typeof input.date === "string" ? input.date : undefined);
      let best: { rider: RiderMetric; distanceKm: number } | null = null;
      const all: { name: string; city: string | null; distanceKm: number }[] = [];
      for (const rider of leaderboard.riders) {
        const cell = rider.totalsByDay[key];
        if (!cell) continue;
        all.push({ name: rider.name, city: rider.city, distanceKm: Math.round(cell.distanceKm * 10) / 10 });
        if (!best || cell.distanceKm > best.distanceKm) {
          best = { rider, distanceKm: cell.distanceKm };
        }
      }
      if (!best) {
        return { date: key, label, message: `No qualifying rides recorded for ${label} (${key}) yet.` };
      }
      all.sort((a, b) => b.distanceKm - a.distanceKm);
      return {
        date: key,
        label,
        topRider: { name: best.rider.name, city: best.rider.city, distanceKm: Math.round(best.distanceKm * 10) / 10 },
        allRidersToday: all.slice(0, 20),
      };
    }

    case "get_city_stats": {
      const cityInput = typeof input.city === "string" ? input.city.trim() : "";
      if (!cityInput) {
        return leaderboard.topCities
          .slice(0, 15)
          .map((c) => ({ city: c.place, riderCount: c.riderCount, totalDistanceKm: Math.round(c.totalDistanceKm) }));
      }
      const normalized = normalizeCity(cityInput);
      const match = leaderboard.topCities.find((c) => c.place === normalized);
      if (!match) {
        return { found: false, message: `No riders found from "${cityInput}" in this event.` };
      }
      return {
        found: true,
        city: match.place,
        riderCount: match.riderCount,
        totalDistanceKm: Math.round(match.totalDistanceKm),
      };
    }

    case "get_event_rules":
      return { rules: await buildRulesSummary() };

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export const EVENT_CHAT_SYSTEM_PROMPT = `You are a helpful assistant answering rider questions about a CycleNetworkGrow cycling event, using the tools provided. Only answer using data returned by the tools — never guess or make up rider names, distances, or rules. If a tool returns no match or no data, say so plainly rather than inventing an answer. When asked broadly about "the criteria" or "the rules", cover everything get_event_rules returns — ranking, points, bonus points, qualifying-ride requirements, AND the finisher medal/certificate quota — don't drop any of it. Keep answers short and conversational, suitable for a chat widget. Distances are in kilometers. All dates/times are India Standard Time (IST).

The person you're chatting with is already signed in — you know who they are from their session, not from anything they type. For any question about themselves ("my progress", "my rank", "how am I doing", "where do I stand"), call get_my_standing directly. Never ask them to provide their name or identify themselves first.

This is a plain-text chat bubble, not a markdown renderer — never use markdown syntax (no **bold**, no # headers, no *,- bullet lists, no numbered lists with periods). Write plain sentences, using line breaks between distinct points instead of bullets or headers.`;
