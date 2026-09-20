import { getActiveSiteAnnouncements } from "@/lib/site-announcement";
import AnnouncementBar from "@/components/AnnouncementBar";

// Server component (fetches whichever scheduled banners are currently in
// their [startAt, endAt] window) wrapping the client presentational bar
// (needs state for the dismiss button) — sits below the Hero, so it
// doesn't interfere with the hero's own overlay-header positioning. See
// /admin/content/home-sections.
export default async function AnnouncementBanner() {
  const announcements = await getActiveSiteAnnouncements();
  return (
    <>
      {announcements.map((a) => (
        <AnnouncementBar key={a.id} message={a.message} variant={a.variant} />
      ))}
    </>
  );
}
