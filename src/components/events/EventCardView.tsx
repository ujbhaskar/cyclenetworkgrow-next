import Link from "next/link";
import { Card, CardBody, CardTitle, Badge } from "react-bootstrap";
import type { EventCard } from "@/lib/models/event";
import EventBannerImage from "@/components/events/EventBannerImage";

// Compact "25 Feb" style, no year — matches the home page card design
// (docs/design/screenshots reference); the full "25 February 2026" form is
// still used on the event detail page, where there's room for it.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default function EventCardView({ event }: { event: EventCard }) {
  return (
    <Card className="h-100 border-0 shadow-sm">
      <EventBannerImage imageUrl={event.imageUrl} alt={event.name} height={250} iconSize={48} />
      <CardBody>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <CardTitle className="h5 mb-0">{event.name}</CardTitle>

          <p className="text-danger text-nowrap small mb-1">
            <i className="bi bi-calendar-event me-1 text-nowrap" aria-hidden /> {formatDate(event.startDate)} –{" "}
            {formatDate(event.endDate)}
          </p>
        </div>
        <hr/>
        {/* Card copy (dates/type/distance) uses the heading font, not the
            body font — matches docs/design/screenshots/Home-4.png, where
            this text has the same rounded, single-story-"a" letterforms as
            the "Upcoming Events" heading rather than the plainer body font
            used for longer-form copy like the FAQ answers. */}
        <div style={{ fontFamily: "var(--font-heading)" }}>
          <Badge bg="light" className="border border-success text-success text-nowrap">
            {event.categoryLabel}
          </Badge>
          <p className="text-muted small mb-1">
            <i className="bi bi-signpost me-1" aria-hidden /> {event.typeLabel}
          </p>
          <p className="text-muted small mb-3">
            <i className="bi bi-speedometer2 me-1" aria-hidden /> {event.distanceLabel}
          </p>
        </div>
        <Link href={`/events/${event.slug}`} className="btn btn-success w-100">
          Know more
        </Link>
      </CardBody>
    </Card>
  );
}
