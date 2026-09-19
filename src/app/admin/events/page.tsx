import { requireRole } from "@/lib/auth/dal";
import { listAllEventsForAdmin } from "@/lib/events";
import EventsTable from "@/components/admin/EventsTable";

export default async function AdminEventsPage() {
  await requireRole("admin");
  const events = await listAllEventsForAdmin();

  return <EventsTable initialEvents={events} />;
}
