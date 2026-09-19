import Link from "next/link";
import Container from "react-bootstrap/Container";
import TornPaperEdge from "@/components/TornPaperEdge";
import { getReadyToRideBannerImageUrl } from "@/lib/site-settings";

export default async function ReadyToRideBanner() {
  const imageUrl = await getReadyToRideBannerImageUrl();

  return (
    <section
      className="position-relative text-light py-5"
      style={{
        // Same brand-toned gradient either way — as a translucent overlay
        // over an admin-uploaded photo (docs/design/screenshots/Home-5.png),
        // or standing alone as a flat background until one is uploaded (see
        // getReadyToRideBannerImageUrl's default of "").
        background: imageUrl
          ? `linear-gradient(135deg, rgba(22,53,42,0.3) 0%, rgba(18,24,31,0.3) 100%), url('${imageUrl}')`
          : "linear-gradient(135deg, #16352a 0%, #12181f 100%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // Overlaps up into Testimonials by the torn band's height, then
        // clips its own top edge into that same jagged shape — this reveals
        // Testimonials' real (flat) background through the notches instead
        // of trying to approximate this section's diagonal gradient with a
        // flat SVG fill color, which doesn't match across the width.
        marginTop: -40,
        clipPath:
          "polygon(0.00% 24px, 4.00% 37px, 8.71% 31px, 13.39% 22px, 15.93% 4px, 18.77% 13px, 24.66% 29px, 29.26% 16px, 32.22% 6px, 37.73% 34px, 43.00% 19px, 46.05% 34px, 48.18% 31px, 53.94% 33px, 56.34% 15px, 60.85% 4px, 63.86% 21px, 68.85% 12px, 72.84% 2px, 77.07% 23px, 81.59% 29px, 86.91% 33px, 89.77% 34px, 93.41% 37px, 95.90% 34px, 98.99% 3px, 100.00% 10px, 100% 100%, 0% 100%)",
      }}
    >
      <Container className="text-center pt-3 pb-5" style={{height: 600, display: "flex", justifyContent: "space-between", flexDirection: "column"}}>
        {/* Uppercase + heavy weight per docs/design/screenshots/Home-5.png —
            still the site's Parkinsans display font, just its heaviest cut,
            rather than a different typeface. */}
        <h2 className="display-1 mb-4" style={{ fontWeight: 600, textTransform: "uppercase" }}>
          Ready to Ride?
        </h2>
        <div className="d-flex justify-content-center gap-3">
          <Link href="/signup" className="btn btn-success btn-lg">
            Join Now
          </Link>
          <Link href="/events" className="btn btn-outline-brand btn-lg">
            Explore Events
          </Link>
        </div>
      </Container>

      {/* Torn-paper transition into Faq's background (#fafff1). */}
      <TornPaperEdge fill="#fafff1" />
    </section>
  );
}
