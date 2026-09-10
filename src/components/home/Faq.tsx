import { Accordion, AccordionItem, AccordionHeader, AccordionBody } from "react-bootstrap";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import TornPaperEdge from "@/components/TornPaperEdge";

const FAQS = [
  {
    q: "How do I join Let's CNG?",
    a: "Simply click the 'Join Now' button, create your free account, and you're ready to start riding with our community!",
  },
  {
    q: "Do I need to be an experienced cyclist?",
    a: "Not at all — we welcome riders of every level, from complete beginners to seasoned racers. Each event lists its difficulty so you can pick what suits you.",
  },
  {
    q: "Are rides safe?",
    a: "Safety is a priority: rides are organized with planned routes and rest stops, and we encourage riders to follow local traffic rules and wear a helmet at all times.",
  },
  {
    q: "How does the leaderboard work?",
    a: "Once you connect your Strava account, your rides during an active event are tracked automatically and ranked on that event's leaderboard.",
  },
  {
    q: "What gear do I need?",
    a: "A roadworthy bicycle and a helmet are the essentials. Specific events may recommend additional gear depending on terrain and distance.",
  },
];

export default function Faq() {
  return (
    <section className="position-relative py-5" style={{ backgroundColor: "#fdfdf5" }}>
      <Container className="pb-5">
        <Row className="align-items-start g-4">
          <Col md={4}>
            <h2 className="fw-bold">
              Frequently <span className="text-success">Asked</span> Questions
            </h2>
            <p className="text-muted">Learn how to join, ride, and get the most from our cycling community.</p>
          </Col>
          <Col md={8}>
            <Accordion defaultActiveKey="0" flush>
              {FAQS.map((item, i) => (
                <AccordionItem eventKey={String(i)} key={item.q}>
                  <AccordionHeader>{item.q}</AccordionHeader>
                  <AccordionBody className="text-muted">{item.a}</AccordionBody>
                </AccordionItem>
              ))}
            </Accordion>
          </Col>
        </Row>
      </Container>

      {/* Torn-paper transition into the Footer's flat dark background. */}
      <TornPaperEdge fill="#0d150d" />
    </section>
  );
}
