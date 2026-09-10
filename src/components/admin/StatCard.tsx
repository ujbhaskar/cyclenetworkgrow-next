import { Card, CardBody } from "react-bootstrap";

export default function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: string;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <CardBody className="d-flex align-items-center gap-3">
        <div
          className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          style={{ width: 48, height: 48, backgroundColor: "rgba(var(--bs-primary-rgb), 0.1)" }}
        >
          <i className={`bi ${icon} text-primary`} style={{ fontSize: 22 }} aria-hidden />
        </div>
        <div>
          <div className="fs-3 fw-semibold lh-1">{value}</div>
          <div className="text-muted small mt-1">{label}</div>
          {subtext && <div className="text-muted" style={{ fontSize: 11 }}>{subtext}</div>}
        </div>
      </CardBody>
    </Card>
  );
}
