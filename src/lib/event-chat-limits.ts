import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { istDayKey } from "@/lib/rider-metrics";
import type { EventChatConfig, ChatUsageDay } from "@/lib/models/event-chat";

export type { EventChatConfig, ChatUsageDay } from "@/lib/models/event-chat";

// Admin-configurable on/off switch and daily cost cap for the event
// chatbot (src/lib/event-chat.ts) — same "one settings doc" pattern as
// ride-rules.ts's RideRulesConfig. OpenAI's own dashboard only offers an
// org-wide monthly $ budget, not a per-day request count, so the actual
// daily cap has to be enforced here.
const CONFIG_COLLECTION = "eventChatConfig";
const CONFIG_DOC_ID = "default";
const USAGE_COLLECTION = "eventChatUsage";

const DEFAULT_CONFIG: EventChatConfig = { enabled: true, dailyLimit: 100 };

export async function getEventChatConfig(): Promise<EventChatConfig> {
  const doc = await adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get();
  if (!doc.exists) {
    return DEFAULT_CONFIG;
  }
  const data = doc.data() ?? {};
  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : DEFAULT_CONFIG.enabled,
    dailyLimit:
      typeof data.dailyLimit === "number" && data.dailyLimit > 0 ? data.dailyLimit : DEFAULT_CONFIG.dailyLimit,
  };
}

export async function updateEventChatConfig(input: EventChatConfig, updatedBy: string): Promise<void> {
  await adminDb
    .collection(CONFIG_COLLECTION)
    .doc(CONFIG_DOC_ID)
    .set({ ...input, updatedBy, updatedAt: new Date().toISOString() }, { merge: true });
}

function todayKey(): string {
  return istDayKey(new Date().toISOString());
}

export type ChatUsageCheck = { allowed: boolean; count: number; limit: number };

/**
 * Atomically checks-and-increments today's usage counter in one Firestore
 * transaction — the actual cost-control boundary the chat route enforces
 * right before spending an OpenAI call, so two concurrent requests landing
 * right at the limit can't both slip through.
 */
export async function checkAndIncrementDailyChatUsage(limit: number): Promise<ChatUsageCheck> {
  const ref = adminDb.collection(USAGE_COLLECTION).doc(todayKey());
  return adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const count = doc.exists ? ((doc.data()?.count as number | undefined) ?? 0) : 0;
    if (count >= limit) {
      return { allowed: false, count, limit };
    }
    tx.set(ref, { count: count + 1, date: todayKey() }, { merge: true });
    return { allowed: true, count: count + 1, limit };
  });
}

/** Most recent `days` of usage, newest first — always includes today (as
 * a zero-count row if no message has been sent yet), for the admin panel. */
export async function getRecentChatUsage(days = 14): Promise<ChatUsageDay[]> {
  const snapshot = await adminDb.collection(USAGE_COLLECTION).orderBy("date", "desc").limit(days).get();
  const history = snapshot.docs.map((d) => ({ date: d.id, count: (d.data().count as number | undefined) ?? 0 }));
  const today = todayKey();
  if (!history.some((h) => h.date === today)) {
    history.unshift({ date: today, count: 0 });
  }
  return history.slice(0, days);
}
