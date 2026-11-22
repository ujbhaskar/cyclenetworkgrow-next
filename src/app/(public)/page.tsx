import Hero from "@/components/home/Hero";
import AnnouncementBanner from "@/components/home/AnnouncementBanner";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import Testimonials from "@/components/home/Testimonials";
import ReadyToRideBanner from "@/components/home/ReadyToRideBanner";
import Faq from "@/components/home/Faq";
import AudaxIndia from "@/components/home/AudaxIndia";
import { requireNavAccess } from "@/lib/nav-links";

export default async function HomePage() {
  await requireNavAccess("/");
  return (
    <>
      <Hero />
      {/* Below the hero, not above it — Header overlays the hero
          transparently via `position: absolute` with no positioned
          ancestor, so any in-flow content placed before Hero would render
          underneath that overlay instead of pushing it down. */}
      <AnnouncementBanner />
      <UpcomingEvents />
      <Testimonials />
      <ReadyToRideBanner />
      <Faq />
      <AudaxIndia />
    </>
  );
}
