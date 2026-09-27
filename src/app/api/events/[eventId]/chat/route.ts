import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getOptionalSession } from "@/lib/auth/dal";
import { getUserProfile } from "@/lib/user-profile";
import { getEventBySlug } from "@/lib/events";
import { getEventLeaderboard } from "@/lib/rider-metrics";
import { EVENT_CHAT_TOOLS, EVENT_CHAT_SYSTEM_PROMPT, runEventChatTool, type EventChatToolName } from "@/lib/event-chat";
import { getEventChatConfig, checkAndIncrementDailyChatUsage } from "@/lib/event-chat-limits";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

type ChatMessage = { role: "user" | "assistant"; content: string };

const MODEL = "gpt-4o";
const MAX_TOOL_ROUNDS = 4; // guards against a runaway tool-call loop

/**
 * @swagger
 * /api/events/{eventId}/chat:
 *   post:
 *     summary: Ask the event chatbot a question
 *     description: >
 *       Runs an OpenAI function-calling loop, grounded entirely in this event's already-computed
 *       leaderboard data (src/lib/rider-metrics.ts) and its actual verified rules — never the
 *       raw rules PDF. `messages` is the full conversation so far (client keeps history);
 *       the reply continues it.
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: "{ reply: string }"
 *       400:
 *         description: Bad request, or the chatbot isn't configured (no OPENAI_API_KEY)
 *       401:
 *         description: Not signed in
 *       403:
 *         description: Chatbot disabled by an admin
 *       429:
 *         description: Today's shared usage cap has been reached
 */
export async function POST(request: Request, { params }: RouteParams) {
  // Client-side already hides the chat widget from signed-out visitors
  // (see the event page), but that's just UX — this is the actual
  // authorization boundary, same rule as every other privileged/per-user
  // route (see docs/ARCHITECTURE.md §4).
  const session = await getOptionalSession();
  if (!session) {
    return Response.json({ error: "Please log in to use the event chat." }, { status: 401 });
  }

  const config = await getEventChatConfig();
  if (!config.enabled) {
    return Response.json({ error: "The event chatbot is currently turned off." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chat isn't configured yet — OPENAI_API_KEY is missing on the server." },
      { status: 400 },
    );
  }

  // Checked (and counted) before spending an OpenAI call, not after — the
  // whole point is to cap cost, so a request that would push past the cap
  // never reaches OpenAI at all. Shared across every rider/event; see
  // /admin/events/chatbot for today's count and to change the cap.
  const usage = await checkAndIncrementDailyChatUsage(config.dailyLimit);
  if (!usage.allowed) {
    return Response.json(
      { error: "The event chat has reached its shared daily limit — please try again tomorrow." },
      { status: 429 },
    );
  }

  const { eventId } = await params;
  const body = await request.json().catch(() => ({}));
  const history: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages.filter(
        (m: unknown): m is ChatMessage =>
          typeof m === "object" &&
          m !== null &&
          (m as ChatMessage).role !== undefined &&
          typeof (m as ChatMessage).content === "string",
      )
    : [];
  if (history.length === 0) {
    return Response.json({ error: "No messages given" }, { status: 400 });
  }

  const event = await getEventBySlug(eventId);
  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 400 });
  }
  const leaderboard = await getEventLeaderboard(event);

  // Resolved from the session, never from anything the model or client
  // sends — this is what lets get_my_standing answer "my progress"
  // without the bot ever asking the rider who they are. RiderMetric.phone
  // is the bare 10-digit format (no country code), unlike the profile's
  // own normalizePhone()-formatted "+91..." value, so strip down to match
  // (same conversion the event page itself does).
  const profile = await getUserProfile(session.uid);
  const currentPhone = profile?.phone ? profile.phone.replace(/\D/g, "").slice(-10) : null;

  const client = new OpenAI({ apiKey });
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: EVENT_CHAT_SYSTEM_PROMPT },
    ...history.map((m): ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        tools: EVENT_CHAT_TOOLS,
        messages,
      });

      const choice = response.choices[0].message;

      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        const reply = choice.content?.trim();
        return Response.json({ reply: reply || "Sorry, I couldn't come up with an answer for that." });
      }

      messages.push(choice);
      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== "function") continue;
        const input = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        const result = await runEventChatTool(
          toolCall.function.name as EventChatToolName,
          input,
          event,
          leaderboard,
          currentPhone,
        );
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    }

    return Response.json({ reply: "Sorry, that question needs more lookups than I can do right now — try rephrasing it more simply." });
  } catch (err) {
    console.error("[event chat] failed:", err);
    return Response.json({ error: "Something went wrong answering that — please try again." }, { status: 400 });
  }
}
