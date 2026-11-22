"use client";

// − 1 + control. `max` is the per-line cap.
export default function QtyStepper({
  value,
  max,
  onChange,
  disabled,
  size = "sm",
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const btn = `btn btn-outline-secondary ${size === "sm" ? "btn-sm" : ""}`;
  return (
    <div className="d-inline-flex align-items-center gap-2" role="group" aria-label="Quantity">
      <button type="button" className={btn} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        −
      </button>
      <span className="text-center fw-semibold" style={{ minWidth: 24 }} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
