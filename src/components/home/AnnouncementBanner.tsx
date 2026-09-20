import { getSiteAnnouncement } from "@/lib/site-announcement";

// Server component (no client state) — sits above the Hero, so it doesn't
// interfere with the hero's own overlay-header positioning. See
// /admin/content/home-sections.
export default async function AnnouncementBanner() {
  const announcement = await getSiteAnnouncement();
  if (!announcement.enabled || !announcement.message) {
    return null;
  }
  return (
    <div className={`alert alert-${announcement.variant} text-center rounded-0 mb-0 py-2`}>
      {announcement.message}
    </div>
  );
}
