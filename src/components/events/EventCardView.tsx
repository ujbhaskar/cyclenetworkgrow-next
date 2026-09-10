import Link from "next/link";
import { Card, CardBody, CardTitle, Badge } from "react-bootstrap";
import type { EventCard } from "@/lib/models/event";
import EventBannerImage from "@/components/events/EventBannerImage";

function formatDate(iso: string): string {
  // Date-only, no time — the legacy source's dates carry no time component
  // (e.g. "2026-09-21"), so showing a derived time would be misleading.
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function EventCardView({ event }: { event: EventCard }) {
  return (
    <Card className="h-100 border-0 shadow-sm">
      <EventBannerImage imageUrl={event.imageUrl} alt={event.name} height={250} iconSize={48} />
      <CardBody>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <CardTitle className="h5 mb-0">{event.name}</CardTitle>
          <Badge bg="success" className="bg-opacity-10 text-success">
            {event.categoryLabel}
          </Badge>
        </div>
        <p className="text-muted small mb-1">
          <i className="bi bi-calendar-event me-1" aria-hidden /> {formatDate(event.startDate)} –{" "}
          {formatDate(event.endDate)}
        </p>
        <p className="text-muted small mb-1">
          <i className="bi bi-signpost me-1" aria-hidden /> {event.typeLabel}
        </p>
        <p className="text-muted small mb-3">
          <i className="bi bi-speedometer2 me-1" aria-hidden /> {event.distanceLabel}
        </p>
        <Link href={`/events/${event.slug}`} className="btn btn-success w-100">
          Know more
        </Link>
      </CardBody>
    </Card>
  );
}
