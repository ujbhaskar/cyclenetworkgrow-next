import type { FinishOutlook } from "@/lib/models/finish-outlook";

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="col-6 col-md">
      <div className="border rounded p-2 h-100 bg-white">
        <div className={`fs-4 fw-semibold lh-1 ${tone ?? ""}`}>{value}</div>
        <div className="text-muted small mt-1">{label}</div>
      </div>
    </div>
  );
}

// Admin-only summary above the leaderboard: with `excuseDays` days allowed to be
// missed, how many riders can still reach the mandatory riding days.
export default function FinishOutlookPanel({ outlook, ended }: { outlook: FinishOutlook; ended: boolean }) {
  return (
    <div className="border border-primary border-opacity-25 rounded p-3 mb-4" style={{ background: "#f6f9ff" }}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="badge text-bg-primary">Admin</span>
        <h3 className="h6 fw-bold mb-0">Who can still finish?</h3>
      </div>
      <p className="mb-2 small">
        <strong>
          {ended ? "Event ended" : `Day ${outlook.dayNumber}`} of {outlook.totalDays}
        </strong>
        {" · "}
        {outlook.mandatoryDays} riding days are mandatory, so a rider can miss at most{" "}
        <strong>{outlook.excuseDays} days</strong> ({outlook.totalDays} − {outlook.mandatoryDays}).{" "}
        {outlook.minimumDaysNow > 0 ? (
          <>
            To still be in the running today a rider needs at least <strong>{outlook.minimumDaysNow} riding days</strong> (
            {outlook.dayNumber} − {outlook.excuseDays}); {outlook.daysLeft} day{outlook.daysLeft === 1 ? "" : "s"} remain after today.
          </>
        ) : (
          <>Nobody can be out yet — every rider is allowed to miss the first {outlook.excuseDays} days.</>
        )}
      </p>
      <div className="row g-2 mb-2">
        <Stat value={outlook.counts.registered} label="Registered" />
        <Stat value={outlook.counts.riding} label="Have ridden at least once" />
        <Stat value={outlook.counts.possible} label={`Possible finishers (${outlook.minimumDaysNow}+ days)`} tone="text-primary" />
        <Stat value={outlook.counts.completed} label={`Already ridden ${outlook.mandatoryDays}+ days`} tone="text-success" />
        <Stat value={outlook.counts.out} label="Out of reach" tone="text-secondary" />
      </div>
      <p className="text-muted mb-0" style={{ fontSize: 12 }}>
        A riding day is a day with a qualifying ride (25&nbsp;km or more — the &quot;Total Rides&quot; column). Today counts as
        missed until the rider has ridden today. &quot;Ridden {outlook.mandatoryDays}+ days&quot; is the day count only; the
        🏆 also needs every distance bracket&apos;s quota.
      </p>
    </div>
  );
}
