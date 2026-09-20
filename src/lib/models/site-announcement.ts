// The home page's announcement banners — a fully admin-authored, scheduled
// list (message + style + start/end time), so an admin can plan several in
// advance (e.g. "registration closing" now, "event started" later) instead
// of manually flipping one on/off switch. See /admin/content/home-sections.
// No server-only import, so both the admin form (client component) and
// server code can import it.

export const ANNOUNCEMENT_VARIANTS = ["info", "warning", "success", "danger"] as const;
export type AnnouncementVariant = (typeof ANNOUNCEMENT_VARIANTS)[number];

export type SiteAnnouncement = {
  id: string;
  message: string;
  variant: AnnouncementVariant;
  // Manual pause independent of the schedule — lets an admin turn one off
  // early without deleting it or editing its dates.
  enabled: boolean;
  // ISO datetimes — the banner only shows when `enabled` and `now` is
  // within [startAt, endAt].
  startAt: string;
  endAt: string;
};

// What a client submits when saving the whole list — id is assigned
// server-side from array position.
export type SiteAnnouncementInput = {
  message: string;
  variant: AnnouncementVariant;
  enabled: boolean;
  startAt: string;
  endAt: string;
};
