// Types shared between the server-only data layer (src/lib/event-chat-limits.ts)
// and the admin settings client component (EventChatAdminPanel.tsx) — kept in a
// plain module, no `server-only` import, same reasoning as models/ride-rules.ts.

export type EventChatConfig = {
  enabled: boolean;
  dailyLimit: number;
};

export type ChatUsageDay = { date: string; count: number };
