import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { requireRole } from "@/lib/auth/dal";
import { listAllUsers } from "@/lib/admin-user-management";
import StatCard from "@/components/admin/StatCard";

export default async function AdminDashboardPage() {
  // Re-checked here even though admin/layout.tsx already checked it this
  // request — React's cache() makes this free, and every real data-reading
  // page should call it directly rather than relying on the layout alone.
  await requireRole("admin");

  const users = await listAllUsers();
  const riderCount = users.filter((u) => u.role === "rider").length;
  const adminCount = users.filter((u) => u.role === "admin" || u.role === "manager").length;

  return (
    <div>
      <h1 className="h3 mb-1">Dashboard</h1>
      <p className="text-muted mb-4">Overview of the platform — see docs/REQUIREMENTS.md §3.5.</p>

      <Row className="g-3">
        <Col md={4}>
          <StatCard icon="bi-people" label="Total riders" value={String(riderCount)} />
        </Col>
        <Col md={4}>
          <StatCard icon="bi-shield-check" label="Admins & managers" value={String(adminCount)} />
        </Col>
        <Col md={4}>
          <StatCard
            icon="bi-calendar-event"
            label="Active events"
            value="—"
            subtext="Events feature not built yet"
          />
        </Col>
        <Col md={4}>
          <StatCard
            icon="bi-rss"
            label="Strava sync status"
            value="—"
            subtext="Strava integration not built yet"
          />
        </Col>
      </Row>
    </div>
  );
}
