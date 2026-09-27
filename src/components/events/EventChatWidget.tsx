"use client";

import { useState, type FormEvent } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Floating chat button + panel, scoped to one event — history is kept
// client-side and resent in full each turn (see the chat route's
// `messages` body) rather than persisted server-side, since this is a
// local-first MVP with no per-rider session/thread concept yet.
export default function EventChatWidget({
  eventId,
  eventName,
  riderFirstName,
}: {
  eventId: string;
  eventName: string;
  riderFirstName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  // The greeting is display-only — never sent as part of the `messages`
  // payload the API route/OpenAI see, so it doesn't burn tokens on every
  // turn or show up as fake prior context.
  const greeting: ChatMessage | null = riderFirstName
    ? { role: "assistant", content: `Hi ${riderFirstName}, how may I help you?` }
    : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayMessages = greeting ? [greeting, ...messages] : messages;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setSending(true);

    try {
      const res = await fetch(`/api/events/${eventId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't get an answer");
      }
      setMessages((current) => [...current, { role: "assistant", content: body.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get an answer");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-success rounded-circle shadow"
        style={{ position: "fixed", bottom: 20, right: 20, width: 56, height: 56, zIndex: 1050 }}
        onClick={() => setOpen(true)}
        aria-label="Ask about this event"
        title="Ask about this event"
      >
        <i className="bi bi-chat-dots fs-5" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className="shadow bg-white rounded d-flex flex-column"
      style={{ position: "fixed", bottom: 20, right: 20, width: 340, maxWidth: "calc(100vw - 40px)", height: 460, zIndex: 1050 }}
    >
      <div className="d-flex align-items-center justify-content-between p-2 border-bottom bg-success text-white rounded-top">
        <span className="fw-semibold small">Ask about {eventName}</span>
        <button
          type="button"
          className="btn btn-sm btn-link text-white p-0"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
        >
          <i className="bi bi-x-lg" aria-hidden />
        </button>
      </div>

      <div className="flex-grow-1 overflow-auto p-2" style={{ fontSize: 14 }}>
        {displayMessages.length === 0 && (
          <p className="text-muted small mb-0">
            Ask things like &ldquo;who&apos;s leading today&rdquo;, &ldquo;how many riders from Chennai&rdquo;, or
            &ldquo;what are the rules&rdquo;.
          </p>
        )}
        {displayMessages.map((m, i) => (
          <div key={i} className={`mb-2 d-flex ${m.role === "user" ? "justify-content-end" : "justify-content-start"}`}>
            <div
              className={`px-2 py-1 rounded ${m.role === "user" ? "bg-success text-white" : "bg-light border"}`}
              style={{ maxWidth: "85%", whiteSpace: "pre-wrap" }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <p className="text-muted small mb-0">Thinking…</p>}
        {error && <p className="text-danger small mb-0">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="d-flex gap-1 p-2 border-top">
        <input
          type="text"
          className="form-control form-control-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={sending}
        />
        <button type="submit" className="btn btn-sm btn-success" disabled={sending || !input.trim()}>
          <i className="bi bi-send" aria-hidden />
        </button>
      </form>
    </div>
  );
}
