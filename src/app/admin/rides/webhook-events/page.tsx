import { requireRole } from "@/lib/auth/dal";
import { listStravaWebhookEvents } from "@/lib/strava-webhook-events";
import StravaWebhookEventsTable from "@/components/admin/StravaWebhookEventsTable";

export default async function AdminStravaWebhookEventsPage() {
  await requireRole("admin");
  const firstPage = await listStravaWebhookEvents(null, 50);

  return (
    <div>
      <h1 className="h3 mb-1">Strava Webhook Events</h1>
      <p className="text-muted mb-4">
        The raw audit log every Strava push event gets recorded to (see the Strava Subscription page), newest
        first — regardless of whether it went on to create/update a ride. Entries auto-expire 7 days after arrival.
      </p>
      <StravaWebhookEventsTable initialEvents={firstPage.events} initialCursor={firstPage.nextCursor} />
    </div>
  );
}
