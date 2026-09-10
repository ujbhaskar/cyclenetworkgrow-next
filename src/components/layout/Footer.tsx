import Image from "next/image";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const PAGE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  // { href: "/shop", label: "Shop" },
  // { href: "/blog", label: "Blog" },
];

// Matches the real accounts linked from the current site's footer.
const SOCIAL_LINKS = [
  { href: "https://www.instagram.com/cyclenetworkgrow", icon: "bi-instagram", label: "Instagram" },
  { href: "https://www.facebook.com/cyclenetworkgrow", icon: "bi-facebook", label: "Facebook" },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "#0d150d" }} className="text-light pt-5 pb-4 mt-auto">
      <Container>
        <Row className="gy-4">
          <Col lg={5}>
            <Image
              src="/logo.png"
              alt="Cycle Network Grow"
              width={160}
              height={48}
              style={{ height: 40, width: "auto", filter: "brightness(0) invert(1)" }}
            />
            <p className="text-light opacity-75 mt-3" style={{ maxWidth: 380 }}>
              India&apos;s growing cycling community — join events, track your rides, and connect
              with riders near you.
            </p>
          </Col>

          <Col lg={3}>
            <p className="fw-semibold mb-3">Pages</p>
            <ul className="list-unstyled">
              {PAGE_LINKS.map((link) => (
                <li key={link.href} className="mb-2">
                  <Link href={link.href} className="text-light text-opacity-75 text-decoration-none">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Col>

          <Col lg={4}>
            <p className="fw-semibold mb-3">Follow Us</p>
            <div className="d-flex gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="d-flex align-items-center justify-content-center border rounded"
                  style={{ width: 36, height: 36, borderColor: "rgba(255,255,255,0.3)" }}
                >
                  <i className={`bi ${social.icon} text-light`} aria-hidden />
                </a>
              ))}
            </div>
          </Col>
        </Row>

        <hr className="border-secondary mt-4" />
        <p className="text-center text-light text-opacity-50 small mb-0">
          &copy; {new Date().getFullYear()} Copyright <strong>CNG Foundation</strong>.
        </p>
      </Container>
    </footer>
  );
}
