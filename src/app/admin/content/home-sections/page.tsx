import { requireRole } from "@/lib/auth/dal";
import { getHomeHeroImageUrl, getReadyToRideBannerImageUrl } from "@/lib/site-settings";
import { getHeroStats } from "@/lib/hero-stats";
import { getSiteStats } from "@/lib/site-stats";
import { listSiteAnnouncements } from "@/lib/site-announcement";
import BannerUploadForm from "@/components/admin/BannerUploadForm";
import HeroStatsForm from "@/components/admin/HeroStatsForm";
import SiteAnnouncementForm from "@/components/admin/SiteAnnouncementForm";

export default async function AdminHomeSectionsPage() {
  await requireRole("admin");
  const [heroImageUrl, readyToRideImageUrl, heroStats, siteStats, announcements] = await Promise.all([
    getHomeHeroImageUrl(),
    getReadyToRideBannerImageUrl(),
    getHeroStats(),
    getSiteStats(),
    listSiteAnnouncements(),
  ]);

  return (
    <div>
      <h1 className="h3 mb-1">Home Page Sections</h1>
      <p className="text-muted mb-4">Manage the content shown on the public home page.</p>

      <h2 className="h5 mb-3">Announcement Banners</h2>
      <p className="text-muted">
        Scheduled messages shown near the top of the home page — plan several ahead of time (e.g.
        one for a registration deadline, another for when the event starts), each with its own
        start/expiry time. Only banners currently inside their window (and switched on) show up.
      </p>
      <SiteAnnouncementForm announcements={announcements} />

      <hr className="my-4" />

      <h2 className="h5 mb-3">Hero Banner</h2>
      <p className="text-muted">
        This image is used as the background of the home page&apos;s hero section, behind the
        &quot;Ride Together, Grow Together&quot; headline.
      </p>
      <BannerUploadForm currentUrl={heroImageUrl} uploadEndpoint="/api/admin/hero-banner" />

      <hr className="my-4" />

      <h2 className="h5 mb-3">Hero Stat Tiles</h2>
      <p className="text-muted">
        The small stat cards under the hero headline (e.g. &quot;375+ Riders&quot;). Add, remove,
        reorder, and edit any of them — both the number/value and the label are plain text you
        control.
      </p>
      <HeroStatsForm stats={heroStats} reference={siteStats} />

      <hr className="my-4" />

      <h2 className="h5 mb-3">&quot;Ready to Ride?&quot; Banner</h2>
      <p className="text-muted">
        This image is used as the background of the &quot;Ready to Ride?&quot; section near the
        bottom of the home page. Leave it empty to show a plain dark gradient instead.
      </p>
      <BannerUploadForm
        currentUrl={readyToRideImageUrl}
        uploadEndpoint="/api/admin/ready-to-ride-banner"
      />
    </div>
  );
}
