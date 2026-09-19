import Hero from "@/components/home/Hero";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import Testimonials from "@/components/home/Testimonials";
import ReadyToRideBanner from "@/components/home/ReadyToRideBanner";
import Faq from "@/components/home/Faq";
import AudaxIndia from "@/components/home/AudaxIndia";

export default function HomePage() {
  return (
    <>
      <Hero />
      <UpcomingEvents />
      <Testimonials />
      <ReadyToRideBanner />
      <Faq />
      <AudaxIndia />
    </>
  );
}
