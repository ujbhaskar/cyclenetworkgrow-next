import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getPastEvents, getUpcomingEvents, isEventLive } from "@/lib/events";
import EventCardView from "@/components/events/EventCardView";

export default async function EventsListPage() {
  const [upcomingOrLive, past] = await Promise.all([getUpcomingEvents(50), getPastEvents(5)]);
  // getUpcomingEvents returns anything not yet ended, which includes events
  // already in progress — split those out so an event that has started
  // reads as "Live" rather than sitting under "Upcoming" once it no longer is.
  const live = upcomingOrLive.filter(isEventLive);
  const upcoming = upcomingOrLive.filter((event) => !isEventLive(event));

  return (
    <Container className="py-3">
      <h1 className="fw-bold mb-4">Events</h1>

      {live.length > 0 && (
        <>
          <h2 className="h4 mb-3">Live Events</h2>
          <Row className="g-4 mb-5">
            {live.map((event) => (
              <Col md={4} key={event.id}>
                <EventCardView event={event} />
              </Col>
            ))}
          </Row>
        </>
      )}

      {upcoming.length > 0 ? (
        <>
          <h2 className="h4 mb-3">Upcoming Events</h2>
          <Row className="g-4 mb-5">
            {upcoming.map((event) => (
              <Col md={4} key={event.id}>
                <EventCardView event={event} />
              </Col>
            ))}
          </Row>
        </>
      ) : (
        live.length === 0 && (
          <>
            <h2 className="h4 mb-3">Upcoming Events</h2>
            <p className="text-muted mb-5">No upcoming events right now — check back soon!</p>
          </>
        )
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
