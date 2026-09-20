import Link from "next/link";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getUpcomingEvents, isEventLive } from "@/lib/events";
import EventCardView from "@/components/events/EventCardView";

export default async function UpcomingEvents() {
  const events = await getUpcomingEvents(3);
  // getUpcomingEvents includes events already in progress — once one has
  // started, this heading should read "Live Events" rather than
  // "Upcoming Events" for it (see /events, which does the same split).
  const anyLive = events.some(isEventLive);

  return (
    <section className="py-3" style={{ backgroundColor: "#fafff1" }}>
      <Container className="pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3 flex-grow-1">
            <h1 className="mb-0 text-nowrap">{anyLive ? "Live Events" : "Upcoming Events"}</h1>
            <hr className="flex-grow-1 my-0 opacity-50" style={{ borderTop: "2px solid currentColor" }} />
          </div>
          <Link href="/events" className="text-decoration-none text-nowrap ms-3">
            View all <i className="bi bi-arrow-right" aria-hidden />
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-muted">No upcoming events right now — check back soon!</p>
        ) : (
          <Row className="g-4 mb-5">
            {events.map((event) => (
              <Col md={4} key={event.id}>
                <EventCardView event={event} />
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </section>
  );
}
