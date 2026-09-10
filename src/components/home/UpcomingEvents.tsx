import Link from "next/link";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getUpcomingEvents } from "@/lib/events";
import EventCardView from "@/components/events/EventCardView";

export default async function UpcomingEvents() {
  const events = await getUpcomingEvents(3);

  return (
    <section className="py-3" style={{ backgroundColor: "#fdfdf5" }}>
      <Container className="pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-bold mb-0">Upcoming Events</h2>
          <Link href="/events" className="text-decoration-none">
            View all <i className="bi bi-arrow-right" aria-hidden />
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-muted">No upcoming events right now — check back soon!</p>
        ) : (
          <Row className="g-4">
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
