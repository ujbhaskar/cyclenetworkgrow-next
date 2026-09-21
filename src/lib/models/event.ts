// One event model — the same `events` Firestore collection and core
// schema the legacy Angular admin's add-event/edit-event forms use (see
// letscng-ui's events-control/events.model.ts and add-event.component.ts).
// This app used to keep a second, separate "cyclingEvents" collection/
// schema for events created here, merged at read time with the legacy
// ones — deliberately collapsed back into one on 2026-09-18, since having
// two different kinds of events (one admin flow for new events, a
// different read-only one for the 27 real events) was exactly the
// confusion this rebuild was supposed to remove.
//
// Deliberately NOT modeled yet: `eastEnduranceRules` (a whole nested
// medal-cutoff-times sub-form, only used by category "east-endurance") and
// `configuration` (online-event quotas + point-system sub-form, only used
// when eventType is "online"). Both are still read/written verbatim
// through EventDoc's index signature, so editing an existing East
// Endurance or online event never wipes them — this app's own admin form
// just doesn't expose UI for those two sub-forms yet.

import { ANNOUNCEMENT_VARIANTS, type AnnouncementVariant } from "@/lib/models/site-announcement";
export { ANNOUNCEMENT_VARIANTS };
export type { AnnouncementVariant };

export const EVENT_CATEGORIES = ["east-endurance", "1177", "aw80d", "rising-star", "special", "purchase"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUSES = ["NotStarted", "Started", "Completed", "Archived", "Hidden"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_TYPES = ["online", "offline"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// The Firestore doc shape, read side — every field optional since the 27
// real docs are inconsistently populated (older editions predate some
// fields entirely). Includes the not-yet-modeled nested sub-forms as
// `unknown` so they round-trip untouched.
export type EventDoc = {
  name?: string;
  description?: string;
  image?: string; // base64-encoded Firebase Storage URL, matching the legacy encodeUrl() helper
  startDate?: string;
  endDate?: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  path?: string;
  category?: string;
  publish?: boolean;
  rules?: string;
  payment_link?: string;
  distance?: string | number;
  minDistance?: string;
  metrics?: string;
  eventType?: string;
  status?: string;
  archive?: string;
  registeredGoogleDataXLS?: string;
  ultraPoints?: string;
  // Admin-authored notice shown at the top of this event's public detail
  // page (e.g. "registration closes 21st Sept") — plain text, not part of
  // the legacy schema, blank/absent means no banner.
  bannerMessage?: string;
  // Bootstrap alert style for the above — same variant set as the home
  // page's site-wide announcements. Absent (older docs, predating this
  // field) defaults to "warning", matching this banner's original
  // hardcoded look.
  bannerVariant?: string;
  riders?: Record<string, unknown>;
  eastEnduranceRules?: unknown;
  configuration?: unknown;
  teams?: unknown;
};

// Fields the admin create/edit form actually submits.
export type EventInput = {
  name: string;
  description: string;
  image: string;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
  path: string;
  category: string;
  publish: boolean;
  rules: string;
  payment_link: string;
  distance: string;
  minDistance: string;
  metrics: string;
  eventType: string;
  status: string;
  registeredGoogleDataXLS?: string;
  bannerMessage?: string;
  bannerVariant?: string;
};

// Display-ready shape for the public home page.
export type EventCard = {
  id: string;
  // URL segment for the public detail page (/events/<slug>) — the doc's
  // `path` field, the same slug the production Angular app uses
  // (/cng-events/<path>), falling back to the doc id when a doc has no
  // `path`.
  slug: string;
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
  bannerMessage: string | null;
  bannerVariant: AnnouncementVariant;
};
