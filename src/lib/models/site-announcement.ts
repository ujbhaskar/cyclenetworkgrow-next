// The home page's global announcement banner — one admin-authored message,
// shown (or not) at the top of the home page. See
// /admin/content/home-sections. No server-only import, so both the admin
// form (client component) and server code can import it.

export const ANNOUNCEMENT_VARIANTS = ["info", "warning", "success", "danger"] as const;
export type AnnouncementVariant = (typeof ANNOUNCEMENT_VARIANTS)[number];

export type SiteAnnouncement = {
  enabled: boolean;
  message: string;
  variant: AnnouncementVariant;
};

export const DEFAULT_SITE_ANNOUNCEMENT: SiteAnnouncement = {
  enabled: false,
  message: "",
  variant: "info",
};
