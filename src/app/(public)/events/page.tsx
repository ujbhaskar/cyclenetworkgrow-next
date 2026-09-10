import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getPastEvents, getUpcomingEvents } from "@/lib/events";
import EventCardView from "@/components/events/EventCardView";

export default async function EventsListPage() {
  const [upcoming, past] = await Promise.all([getUpcomingEvents(50), getPastEvents(5)]);

  return (
    <Container className="py-3">
      <h1 className="fw-bold mb-4">Events</h1>

      <h2 className="h4 fw-bold mb-3">Upcoming Events</h2>
      {upcoming.length === 0 ? (
        <p className="text-muted mb-5">No upcoming events right now — check back soon!</p>
      ) : (
        <Row className="g-4 mb-5">
          {upcoming.map((event) => (
            <Col md={4} key={event.id}>
              <EventCardView event={event} />
            </Col>
          ))}
        </Row>
      )}

      <h2 className="h4 fw-bold mb-3">Past Events</h2>
      {past.length === 0 ? (
        <p className="text-muted">No past events yet.</p>
      ) : (
        <Row className="g-4">
          {past.map((event) => (
            <Col md={4} key={event.id}>
              <EventCardView event={event} />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
