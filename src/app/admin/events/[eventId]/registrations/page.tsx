import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getEventAdminDetail } from "@/lib/events";
import RegistrationSyncPanel from "@/components/admin/RegistrationSyncPanel";
import LegacyRidersTable from "@/components/admin/LegacyRidersTable";

export default async function AdminEventRegistrationsPage({
  params,
}: PageProps<"/admin/events/[eventId]/registrations">) {
  await requireRole("admin");
  const { eventId } = await params;
  const event = await getEventAdminDetail(eventId);

  if (!event) {
    notFound();
  }

  return (
    <div>
      <h1 className="h3 mb-1">{event.name ?? "Untitled Event"}</h1>
      <p className="text-muted mb-4">Registration sync from the shared Google Sheet.</p>

      <div className="bg-white border rounded p-3 mb-4">
        <RegistrationSyncPanel eventId={event.id} sheetName={event.registeredGoogleDataXLS ?? null} />
      </div>

      <h2 className="h5 mb-3">Current Riders</h2>
      <LegacyRidersTable eventId={event.id} riders={event.riders} />
    </div>
  );
}
