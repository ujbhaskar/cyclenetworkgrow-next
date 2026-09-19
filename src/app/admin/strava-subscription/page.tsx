import { requireRole } from "@/lib/auth/dal";
import { getStravaSubscription } from "@/lib/strava";
import StravaSubscriptionPanel from "@/components/admin/StravaSubscriptionPanel";

// Deep-links into Cloud Logging / Firestore Console, pre-scoped so "is
// Strava sending us anything" is one click instead of a gcloud command.
const WEBHOOK_LOGS_URL =
  "https://console.cloud.google.com/logs/query;query=" +
  encodeURIComponent(
    'resource.type="cloud_run_revision"\nresource.labels.service_name="cyclenetworkgrow-next"\ntextPayload:"strava webhook"',
  ) +
  "?project=challenge1177";
const WEBHOOK_EVENTS_COLLECTION_URL =
  "https://console.firebase.google.com/project/challenge1177/firestore/databases/-default-/data/~2FstravaWebhookEvents";

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

      <hr className="my-4" />

      <h2 className="h5 mb-2">Is it actually receiving events?</h2>
      <p className="text-muted mb-2">
        Every event Strava sends is logged here regardless of whether it ends up creating a ride — the fastest way to
        confirm data is flowing at all, separate from whether any one event got processed or skipped.
      </p>
      <ul className="mb-0">
        <li>
          <a href={WEBHOOK_LOGS_URL} target="_blank" rel="noopener noreferrer">
            Webhook processing logs (Cloud Logging)
          </a>{" "}
          — each event this app actually acted on: ingested, skipped (with why), or errored.
        </li>
        <li>
          <a href={WEBHOOK_EVENTS_COLLECTION_URL} target="_blank" rel="noopener noreferrer">
            Raw event log (Firestore: stravaWebhookEvents)
          </a>{" "}
          — every event Strava has ever sent this app, unfiltered; sort by <code>receivedAt</code> to see the latest.
        </li>
      </ul>
    </div>
  );
}
