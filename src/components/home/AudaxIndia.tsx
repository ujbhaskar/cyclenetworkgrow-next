import Image from "next/image";
import Container from "react-bootstrap/Container";

// Matches the legacy Angular app's own AudaxindiaComponent (same copy,
// logo, and outbound link) — a real partner listing on audaxindia.in, not
// content we own, so kept verbatim rather than reworded.
const BREVETS_URL = "https://www.audaxindia.in/cycle-network-grow-kolkata-c-82";

export default function AudaxIndia() {
  return (
    <Container className="text-center py-5">
      <h2 className="fw-bold mb-3">Join Us on Audax India</h2>
      <p className="text-muted mb-4" style={{ maxWidth: 720, marginInline: "auto" }}>
        Ready to ride beyond the ordinary? 🚴✨ Join us in upcoming brevets where endurance meets adventure. Challenge
        your limits, explore scenic routes, and share the journey with passionate cyclists. It&apos;s not just about
        distance — it&apos;s about memories, camaraderie, and the thrill of achieving together. 🌍💨
      </p>

      <a href={BREVETS_URL} target="_blank" rel="noopener noreferrer" className="d-inline-block mb-3">
        <Image src="/images/audax-india.jpg" alt="Audax India Randonneurs" width={150} height={146} style={{ height: 80, width: "auto" }} />
      </a>

      <div>
        <a href={BREVETS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary px-4">
          View Our Brevets <i className="bi bi-arrow-up-right" aria-hidden />
        </a>
      </div>
    </Container>
  );
}
