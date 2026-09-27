import { requireRole } from "@/lib/auth/dal";
import { getEventChatConfig, getRecentChatUsage } from "@/lib/event-chat-limits";
import EventChatAdminPanel from "@/components/admin/EventChatAdminPanel";

export default async function AdminEventChatPage() {
  await requireRole("admin");
  const [config, usage] = await Promise.all([getEventChatConfig(), getRecentChatUsage()]);

  return (
    <div>
      <h1 className="h3 mb-1">Event Chatbot</h1>
      <p className="text-muted mb-4">
        Turn the rider-facing event chatbot on/off and set its shared daily message cap — see
        src/lib/event-chat.ts and src/app/api/events/[eventId]/chat/route.ts.
      </p>
      <EventChatAdminPanel initialConfig={config} initialUsage={usage} />
    </div>
  );
}
