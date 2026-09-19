import Link from "next/link";
import Container from "react-bootstrap/Container";
import { getHomeHeroImageUrl } from "@/lib/site-settings";
import { getHeroStats } from "@/lib/hero-stats";
import TornPaperEdge from "@/components/TornPaperEdge";

export default async function Hero() {
  const [heroImageUrl, heroStats] = await Promise.all([getHomeHeroImageUrl(), getHeroStats()]);

  return (
    <section
      className="position-relative text-light py-5"
      style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.35) 100%, rgba(27,42,31,0.52) 55%, rgba(22,53,42,0.58) 100%), url('${heroImageUrl}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Container className="py-5">
        <div style={{ maxWidth: 620 }} className="py-3">
          <span
            className="d-inline-block border border-light border-opacity-50 rounded-pill px-3 py-1 mb-4 small"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            India&apos;s Growing Cycling Community
          </span>
          <h1 className="display-4 fw-bold mb-3">
            Ride Together,
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #4CAF6D 0%, #3E9CC9 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Grow Together
            </span>
          </h1>
          <p className="fs-5 text-light mb-4">
            Join thousands of cyclists exploring new trails, competing in challenges, and building
            lifelong connections.
          </p>
          <div className="d-flex gap-3">
            <Link href="/signup" className="btn btn-brand btn-lg">
              Join Now
            </Link>
            <Link href="/events" className="btn btn-outline-brand btn-lg">
              Explore Events
            </Link>
          </div>
        </div>

        <div className="row g-3 pb-4">
          {heroStats.map((stat) => (
            <StatTile key={stat.id} value={stat.value} label={stat.label} />
          ))}
        </div>
      </Container>

      {/* Torn-paper edge into the next section, per docs/design/screenshots/Home-1.png.
          Fill matches UpcomingEvents' own background (#fafff1). */}
      <TornPaperEdge fill="#fafff1" />
    </section>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="col-6 col-md">
      <div className="h-100 rounded p-3" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
        <div className="fs-3 fw-bold">{value}</div>
        <div className="small text-light">{label}</div>
      </div>
    </div>
  );
}
