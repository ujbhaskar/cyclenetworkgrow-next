import { notFound } from "next/navigation";
import Container from "react-bootstrap/Container";
import { Badge } from "react-bootstrap";
import { getEventBySlug, getPublicEventRiders, isEventUpcoming, isEventNotYetStarted } from "@/lib/events";
import { getEventLeaderboard, EVENT_1177_ID } from "@/lib/rider-metrics";
import { getAw80dLeaderboard, AW80D_EVENT_ID } from "@/lib/aw80d";
import EventLeaderboard from "@/components/events/EventLeaderboard";
import Aw80dLeaderboard from "@/components/events/Aw80dLeaderboard";
import EventBannerImage from "@/components/events/EventBannerImage";
import TornPaperEdge from "@/components/TornPaperEdge";
import { MILESTONES_KM, MILESTONE_QUOTAS } from "@/lib/models/rider-metric";

// The 1×150/3×100/6×75/15×50/30×25KM quota-bracket system (and the
// leaderboard's milestone columns) is specific to the "1177 Grand
// Endurance" event's actual rules — other events on this platform have
// completely different structures (e.g. AW80D 6.0 is team-based with a
// single 1500km individual finisher target and a separate elevation-aware
// points/medal system per its own rules PDF, see src/lib/aw80d.ts). Each
// gets its own leaderboard implementation rather than forcing one generic
// shape onto every event; everything else falls back to a plain distance
// figure with no event-specific leaderboard.
const MILESTONE_QUOTA_EVENT_ID = EVENT_1177_ID;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const isUpcoming = isEventUpcoming(event);
  const eventNotYetStarted = isEventNotYetStarted(event);
  const isAw80d = event.id === AW80D_EVENT_ID;
  const leaderboard = isAw80d ? null : await getEventLeaderboard(event);
  const aw80dLeaderboard = isAw80d ? await getAw80dLeaderboard(event.startDate, event.endDate) : null;
  // Shown as a fallback in EventLeaderboard while there's no ride data yet
  // (e.g. registration is open/closed but the event hasn't started) — AW80D
  // already has its own registered-rider display built into its team
  // leaderboard, so this is only needed for the generic path.
  const registeredRiders = isAw80d ? [] : await getPublicEventRiders(event.id);

  return (
    <div>
      <div className="position-relative">
        <EventBannerImage imageUrl={event.imageUrl} alt={event.name} height={500} iconSize={72} />

        <TornPaperEdge fill="#ffffff" />
      </div>

      <Container className="py-3" style={{ maxWidth: 1100 }}>
        <div className="d-flex flex-column flex-sm-row justify-content-sm-between align-items-start gap-2 mb-3">
          <h1 className="fw-bold mb-0">{event.name}</h1>
          <span>
            <i className="bi bi-calendar-event me-1" aria-hidden /> {formatDate(event.startDate)} –{" "}
            {formatDate(event.endDate)}
          </span>
        </div>

        <div className="d-flex flex-wrap gap-4 text-muted mb-4">
          <Badge bg="success" className="bg-opacity-10 text-success fs-6 flex-shrink-0">
            {event.categoryLabel}
          </Badge>
          <span>
            <i className="bi bi-signpost me-1" aria-hidden /> {event.typeLabel}
          </span>
          <span>
            <i className="bi bi-speedometer2 me-1" aria-hidden />
            {event.id === MILESTONE_QUOTA_EVENT_ID ? (
              <>
                {[...MILESTONES_KM]
                  .reverse()
                  .map((milestone) => `${MILESTONE_QUOTAS[milestone]}×${milestone}KM`)
                  .join(" · ")}{" "}
                <span className="text-muted">
                  ({MILESTONES_KM.reduce((sum, m) => sum + MILESTONE_QUOTAS[m], 0)} qualifying rides)
                </span>
              </>
            ) : isAw80d && aw80dLeaderboard ? (
              <>
                24 riders/team · {aw80dLeaderboard.teamGoalKm.toLocaleString()}km team goal{" "}
                <span className="text-muted">
                  ({aw80dLeaderboard.finisherTargetKm.toLocaleString()}km individual finisher target)
                </span>
              </>
            ) : (
              event.distanceLabel
            )}
          </span>
        </div>

        {/* {event.description && <p className="text-muted">{event.description}</p>} */}

        <div className="d-flex gap-3 mt-3">
          {isUpcoming &&
            (event.paymentLink ? (
              <a
                href={event.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success btn-lg"
              >
                Join Now
              </a>
            ) : (
              <a href="/signup" className="btn btn-success btn-lg">
                Join Now
              </a>
            ))}
          {event.rulesUrl && (
            <a
              href={event.rulesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-secondary btn-lg"
            >
              Rules
            </a>
          )}
        </div>
      </Container>

      {(leaderboard || aw80dLeaderboard) && (
        <Container className="pb-5" style={{ maxWidth: 1100 }}>
          <hr className="mb-4" />
          <h2 className="h4 fw-bold mb-4">Event Leaderboard</h2>
          {/* Trial-mode banner — pairs with rider-metrics.ts's TRIAL_LOOKBACK_MS
              widening the window before the official start. Disappears on its
              own once `now` passes event.startDate, no manual removal needed. */}
          {leaderboard && leaderboard.riders.length > 0 && eventNotYetStarted && (
            <div className="alert alert-warning">
              This leaderboard is a <strong>trial</strong> — it&apos;s showing early test rides so we can confirm
              data is syncing correctly. It will reset on {formatDate(event.startDate)}, when the event officially
              starts.
            </div>
          )}
          {aw80dLeaderboard ? (
            <Aw80dLeaderboard data={aw80dLeaderboard} eventStartDate={event.startDate} eventEndDate={event.endDate} />
          ) : (
            leaderboard && (
              <EventLeaderboard
                data={leaderboard}
                eventStartDate={event.startDate}
                eventEndDate={event.endDate}
                registeredRiders={registeredRiders}
              />
            )
          )}
        </Container>
      )}
    </div>
  );
}
