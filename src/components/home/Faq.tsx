import Image from "next/image";
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
    q: "Can I suggest a new route or event?",
    a: "We'd love to hear it — reach out to our team with your route or event idea and we'll take a look for an upcoming season.",
  },
  {
    q: "How does the leaderboard work?",
    a: "Once you connect your Strava account, your rides during an active event are tracked automatically and ranked on that event's leaderboard.",
  },
  {
    q: "What gear do I need?",
    a: "A roadworthy bicycle and a helmet are the essentials. Specific events may recommend additional gear depending on terrain and distance.",
  },
  {
    // Placeholder copy — intentionally doesn't commit to specific refund
    // terms/timeframes since no real refund policy exists yet to source
    // this from; revise once one is finalized.
    q: "Can I get a refund for event registration?",
    a: "Refund terms can vary by event and are listed on that event's registration page. For questions about a specific registration, get in touch with our team directly.",
  },
];

export default function Faq() {
  return (
    <section className="position-relative py-5" style={{ backgroundColor: "#fafff1" }}>
      <Container className="pb-5">
        <Row className="align-items-start g-4">
          <Col md={6}>
            <p className="text-uppercase small fw-semibold mb-2">
              <span aria-hidden>— </span>Got Questions?
            </p>
            <h2>
              Frequently <span className="text-success">Asked</span> Questions
            </h2>
            <p className="text-muted">Learn how to join, ride, and get the most from our cycling community.</p>
            <Image
              src="/images/faq-illustration.png"
              alt=""
              width={574}
              height={548}
              className="img-fluid mt-0"
              style={{ maxWidth: 320 }}
            />
          </Col>
          <Col md={6}>
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
