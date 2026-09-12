import { requireRole } from "@/lib/auth/dal";
import { getStravaSubscription } from "@/lib/strava";
import StravaSubscriptionPanel from "@/components/admin/StravaSubscriptionPanel";

export default async function AdminStravaSubscriptionPage() {
  await requireRole("admin");
  const subscription = await getStravaSubscription();

  return (
    <div>
      <h1 className="h3 mb-1">Strava Subscription</h1>
      <p className="text-muted mb-4">
        Strava allows only <strong>one push subscription per Client ID, globally</strong> — this app and the legacy
        Angular app share the same Strava API application (Client ID), so whichever one holds the subscription is the
        one actually receiving every connected rider&apos;s activity events, not just this app&apos;s own riders.
      </p>
      <StravaSubscriptionPanel initialSubscription={subscription} />
    </div>
  );
}
