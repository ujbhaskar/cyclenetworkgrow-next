import { Carousel, CarouselItem } from "react-bootstrap";
import Container from "react-bootstrap/Container";
import { getApprovedTestimonials } from "@/lib/testimonials";
import UserAvatar from "@/components/UserAvatar";

// Rider-submitted, admin-approved reviews — see docs/ARCHITECTURE.md §8.3.
// No fabricated placeholder quotes: if nothing's been approved yet, this
// section just doesn't render.
export default async function Testimonials() {
  const testimonials = await getApprovedTestimonials();

  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section className="py-5" style={{ backgroundColor: "#fafff1" }}>
      <Container style={{ maxWidth: 700 }}>
        <h2 className="fw-bold mb-4 text-center">
          What Our <span className="text-success">Riders</span> Say
        </h2>
        <Carousel
          indicators={testimonials.length > 1}
          controls={testimonials.length > 1}
          interval={testimonials.length > 1 ? 6000 : null}
          variant="dark"
        >
          {testimonials.map((t) => (
            <CarouselItem key={t.id}>
              <div className="text-center px-4 pb-5">
                <i className="bi bi-quote text-success fs-1" aria-hidden />
                <UserAvatar
                  photoUrl={t.photoUrl}
                  size={64}
                  className="mb-3"
                  fallback={<span className="fw-semibold">{t.submittedByName.charAt(0).toUpperCase()}</span>}
                />
                <p className="fs-5 mb-3">&ldquo;{t.quote}&rdquo;</p>
                <div className="fw-semibold">{t.submittedByName}</div>
                {t.title && <div className="text-muted small">{t.title}</div>}
              </div>
            </CarouselItem>
          ))}
        </Carousel>
      </Container>
    </section>
  );
}
