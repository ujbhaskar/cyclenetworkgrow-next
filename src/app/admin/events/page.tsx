import { requireRole } from "@/lib/auth/dal";
import { listAllEvents } from "@/lib/events";
import EventsTable from "@/components/admin/EventsTable";

export default async function AdminEventsPage() {
  await requireRole("admin");
  const events = await listAllEvents();

  return <EventsTable initialEvents={events} />;
}
