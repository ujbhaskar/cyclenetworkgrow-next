import { getSiteAnnouncement } from "@/lib/site-announcement";
import AnnouncementBar from "@/components/AnnouncementBar";

// Server component (fetches the config) wrapping the client presentational
// bar (needs state for the dismiss button) — sits below the Hero, so it
// doesn't interfere with the hero's own overlay-header positioning. See
// /admin/content/home-sections.
export default async function AnnouncementBanner() {
  const announcement = await getSiteAnnouncement();
  if (!announcement.enabled || !announcement.message) {
    return null;
  }
  return <AnnouncementBar message={announcement.message} variant={announcement.variant} />;
}
