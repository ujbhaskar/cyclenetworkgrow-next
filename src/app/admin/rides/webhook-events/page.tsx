import { requireRole } from "@/lib/auth/dal";
import { listStravaWebhookEvents, getStravaWebhookEventCount } from "@/lib/strava-webhook-events";
import StravaWebhookEventsTable from "@/components/admin/StravaWebhookEventsTable";

export default async function AdminStravaWebhookEventsPage() {
  await requireRole("admin");
  const [firstPage, totalCount] = await Promise.all([
    listStravaWebhookEvents(null, 50),
    getStravaWebhookEventCount(),
  ]);

  return (
    <div>
      <h1 className="h3 mb-1">Strava Webhook Events</h1>
      <p className="text-muted mb-4">
        The raw audit log of &quot;create&quot; Strava push events (see the Strava Subscription page), newest first —
        regardless of whether it went on to create a ride. Update events and non-activity events are processed
        but not logged. Entries auto-expire 2 days after arrival.
      </p>
      <StravaWebhookEventsTable
        initialEvents={firstPage.events}
        initialCursor={firstPage.nextCursor}
        initialTotalCount={totalCount}
      />
    </div>
  );
}
