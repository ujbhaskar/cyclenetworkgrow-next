import { requireRole } from "@/lib/auth/dal";
import { listStravaConnections } from "@/lib/strava";
import StravaConnectionsTable from "@/components/admin/StravaConnectionsTable";

export default async function AdminStravaRidersPage() {
  await requireRole("admin");
  const connections = await listStravaConnections();

  return <StravaConnectionsTable initialConnections={connections} />;
}
