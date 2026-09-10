// Shared event schema — no server-only dependency, safe for both client
// components (admin forms) and server code (Route Handlers, home page).
// A deliberately lean first cut of docs/ARCHITECTURE.md §9's `events`
// collection — just what the home page card and admin list need today.
// Extend with mode/teamMode/joinMethod/scoringMethod/documents etc. when
// those features get built.

export const EVENT_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type EventDifficulty = (typeof EVENT_DIFFICULTIES)[number];

export type CyclingEvent = {
  id: string;
  name: string;
  description: string;
  category: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  location: string;
  distanceKm: number;
  difficulty: EventDifficulty;
  status: EventStatus;
  createdBy: string;
  createdAt: string;
};

// Fields the admin create/edit form submits — id/createdBy/createdAt are
// server-assigned.
export type EventInput = {
  name: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  location: string;
  distanceKm: number;
  difficulty: EventDifficulty;
  status: EventStatus;
};

// Display-ready shape for the public home page — deliberately looser than
// CyclingEvent so it can represent BOTH this app's own events AND the live
// production app's legacy `events` collection (different schema entirely:
// distance as a messy string, no location field, inconsistent status). See
// src/lib/events.ts's legacy adapter for the mapping. Read-only by design —
// there's no EventCard -> Firestore write path.
export type EventCard = {
  id: string;
  name: string;
  categoryLabel: string;
  startDate: string;
  endDate: string;
  distanceLabel: string;
  targetDistanceKm: number | null;
  typeLabel: string;
  imageUrl: string | null;
  description: string | null;
  paymentLink: string | null;
  rulesUrl: string | null;
};
