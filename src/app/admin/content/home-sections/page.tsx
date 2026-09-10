import { requireRole } from "@/lib/auth/dal";
import { getHomeHeroImageUrl } from "@/lib/site-settings";
import { getHeroStats } from "@/lib/hero-stats";
import { getSiteStats } from "@/lib/site-stats";
import HeroBannerUploadForm from "@/components/admin/HeroBannerUploadForm";
import HeroStatsForm from "@/components/admin/HeroStatsForm";

export default async function AdminHomeSectionsPage() {
  await requireRole("admin");
  const [currentUrl, heroStats, siteStats] = await Promise.all([
    getHomeHeroImageUrl(),
    getHeroStats(),
    getSiteStats(),
  ]);

  return (
    <div>
      <h1 className="h3 mb-1">Home Page Sections</h1>
      <p className="text-muted mb-4">Manage the content shown on the public home page.</p>

      <h2 className="h5 mb-3">Hero Banner</h2>
      <p className="text-muted">
        This image is used as the background of the home page&apos;s hero section, behind the
        &quot;Ride Together, Grow Together&quot; headline.
      </p>
      <HeroBannerUploadForm currentUrl={currentUrl} />

      <hr className="my-4" />

      <h2 className="h5 mb-3">Hero Stat Tiles</h2>
      <p className="text-muted">
        The small stat cards under the hero headline (e.g. &quot;375+ Riders&quot;). Add, remove,
        reorder, and edit any of them — both the number/value and the label are plain text you
        control.
      </p>
      <HeroStatsForm stats={heroStats} reference={siteStats} />
    </div>
  );
}
