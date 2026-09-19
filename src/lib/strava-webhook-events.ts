import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const COLLECTION = "stravaWebhookEvents";

export type StravaWebhookEventRow = {
  id: string;
  objectType: string | null;
  objectId: string | null;
  aspectType: string | null;
  ownerId: string | null;
  subscriptionId: string | null;
  receivedAt: string;
};

export type StravaWebhookEventPage = {
  events: StravaWebhookEventRow[];
  // The last row's receivedAt, ISO — pass back as `cursor` to fetch the
  // next page. null once there's nothing more.
  nextCursor: string | null;
};

export type StravaWebhookEventFilters = {
  /** Strava athlete id (owner_id) — exact match. */
  ownerId?: string;
  /** ISO datetime — only events received at or after this. */
  from?: string;
  /** ISO datetime — only events received at or before this. */
  to?: string;
};

/**
 * Newest-first page of the raw webhook audit log (see the webhook route
 * and docs/DEPLOY.md) — cursor-paginated on `receivedAt` rather than
 * fetching everything at once, since this collection is thousands of rows
 * and grows continuously. Filtering by ownerId needs a composite index
 * (owner_id asc, receivedAt desc) — see docs/DEPLOY.md.
 */
export async function listStravaWebhookEvents(
  cursor: string | null,
  limit: number,
  filters: StravaWebhookEventFilters = {},
): Promise<StravaWebhookEventPage> {
  let query = adminDb.collection(COLLECTION).orderBy("receivedAt", "desc").limit(limit);
  if (filters.ownerId) {
    const ownerIdNumber = Number(filters.ownerId);
    query = query.where("owner_id", "==", Number.isNaN(ownerIdNumber) ? filters.ownerId : ownerIdNumber);
  }
  if (filters.from) {
    query = query.where("receivedAt", ">=", Timestamp.fromDate(new Date(filters.from)));
  }
  if (filters.to) {
    query = query.where("receivedAt", "<=", Timestamp.fromDate(new Date(filters.to)));
  }
  if (cursor) {
    query = query.startAfter(Timestamp.fromDate(new Date(cursor)));
  }

  const snapshot = await query.get();
  const events = snapshot.docs.map((doc) => {
    const data = doc.data();
    const receivedAt = data.receivedAt instanceof Timestamp ? data.receivedAt.toDate() : new Date(data.receivedAt);
    return {
      id: doc.id,
      objectType: data.object_type ?? null,
      objectId: data.object_id != null ? String(data.object_id) : null,
      aspectType: data.aspect_type ?? null,
      ownerId: data.owner_id != null ? String(data.owner_id) : null,
      subscriptionId: data.subscription_id != null ? String(data.subscription_id) : null,
      receivedAt: receivedAt.toISOString(),
    };
  });

  const last = events[events.length - 1];
  return { events, nextCursor: events.length === limit && last ? last.receivedAt : null };
}
