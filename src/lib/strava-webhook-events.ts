import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { ATHLETE_TOKENS_COLLECTION } from "@/lib/strava-tokens";

const COLLECTION = "stravaWebhookEvents";

export type StravaWebhookEventRow = {
  id: string;
  objectType: string | null;
  objectId: string | null;
  aspectType: string | null;
  ownerId: string | null;
  // The rider's name off their athelete_tokens/{ownerId} doc (set at Strava
  // connect time) — null if that owner id has no connected-rider doc, e.g.
  // an athlete who's never linked Strava here or has since disconnected.
  riderName: string | null;
  subscriptionId: string | null;
  receivedAt: string;
  // Set by the webhook route once it's finished processing this event —
  // null for events still in flight, or ones recorded before this was
  // added.
  outcome: string | null;
  outcomeReason: string | null;
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
  const rows = snapshot.docs.map((doc) => {
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
      outcome: data.outcome ?? null,
      outcomeReason: data.outcomeReason ?? null,
    };
  });

  // One batched multi-get for every distinct owner id on this page, rather
  // than a lookup per row — the same owner (an athlete mid-sync) often
  // shows up a dozen times in a row.
  const ownerIds = [...new Set(rows.map((row) => row.ownerId).filter((id): id is string => id !== null))];
  const riderNameByOwnerId = new Map<string, string>();
  if (ownerIds.length > 0) {
    const tokenDocs = await adminDb.getAll(...ownerIds.map((id) => adminDb.collection(ATHLETE_TOKENS_COLLECTION).doc(id)));
    for (const doc of tokenDocs) {
      const athlete = doc.data()?.athlete as { firstname?: string; lastname?: string } | undefined;
      const name = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ");
      if (name) {
        riderNameByOwnerId.set(doc.id, name);
      }
    }
  }

  const events = rows.map((row) => ({
    ...row,
    riderName: row.ownerId ? (riderNameByOwnerId.get(row.ownerId) ?? null) : null,
  }));

  const last = events[events.length - 1];
  return { events, nextCursor: events.length === limit && last ? last.receivedAt : null };
}

/**
 * Total row count — an aggregation query (billed as a handful of reads
 * regardless of collection size, not one read per document), so this is
 * cheap to show alongside the table even as the collection grows.
 */
export async function getStravaWebhookEventCount(): Promise<number> {
  const snapshot = await adminDb.collection(COLLECTION).count().get();
  return snapshot.data().count;
}

// Firestore batched writes cap at 500 operations.
const DELETE_BATCH_SIZE = 500;

/**
 * Wipes the whole audit log on demand (the admin page's "Clear all"
 * button) — irreversible, same as the ride-cleanup tool. listDocuments()
 * rather than get() since deleting only needs each doc's reference, not
 * its data.
 */
export async function deleteAllStravaWebhookEvents(): Promise<{ deleted: number }> {
  const refs = await adminDb.collection(COLLECTION).listDocuments();
  for (let i = 0; i < refs.length; i += DELETE_BATCH_SIZE) {
    const batch = adminDb.batch();
    refs.slice(i, i + DELETE_BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return { deleted: refs.length };
}
