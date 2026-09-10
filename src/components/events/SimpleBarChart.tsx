// Lightweight horizontal bar chart with no charting library dependency —
// used for the bracket-distribution and gender-split insights, which are
// simple enough not to need one.
export type Bar = {
  label: string;
  value: number;
  sublabel?: string;
  color?: string;
};

export default function SimpleBarChart({ title, icon, bars }: { title: string; icon: string; bars: Bar[] }) {
  const maxValue = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="flex-grow-1" style={{ minWidth: 260 }}>
      <h3 className="h6 fw-bold mb-3">
        <i className={`bi ${icon} me-2`} aria-hidden />
        {title}
      </h3>
      {bars.map((bar) => (
        <div key={bar.label} className="mb-2">
          <div className="d-flex justify-content-between small mb-1">
            <span>{bar.label}</span>
            <span className="text-muted">
              {bar.value.toLocaleString()}
              {bar.sublabel ? ` · ${bar.sublabel}` : ""}
            </span>
          </div>
          <div className="progress" style={{ height: 8 }}>
            <div
              className="progress-bar"
              style={{ width: `${(bar.value / maxValue) * 100}%`, backgroundColor: bar.color ?? "#198754" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
