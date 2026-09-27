"use client";

import { useState, type FormEvent } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import ProgressBar from "react-bootstrap/ProgressBar";
import type { EventChatConfig, ChatUsageDay } from "@/lib/models/event-chat";

export default function EventChatAdminPanel({
  initialConfig,
  initialUsage,
}: {
  initialConfig: EventChatConfig;
  initialUsage: ChatUsageDay[];
}) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [dailyLimit, setDailyLimit] = useState(initialConfig.dailyLimit);
  const [usage, setUsage] = useState(initialUsage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const today = usage[0];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/event-chat/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, dailyLimit }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't save these settings.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save these settings.");
    } finally {
      setPending(false);
    }
  }

  async function refreshUsage() {
    const res = await fetch("/api/admin/event-chat/config");
    if (res.ok) {
      const body = await res.json();
      setUsage(body.usage);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">Saved.</Alert>}

      <Form onSubmit={handleSubmit} className="mb-4">
        <Form.Group className="mb-3">
          <Form.Check
            type="switch"
            id="event-chat-enabled"
            label={enabled ? "Chatbot is enabled" : "Chatbot is disabled"}
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Shared daily message limit</Form.Label>
          <Form.Control
            type="number"
            min={1}
            style={{ width: 160 }}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            required
          />
          <Form.Text className="text-muted">
            Total questions allowed across all riders combined, per day — resets at IST midnight. Once reached,
            riders see a &ldquo;try again tomorrow&rdquo; message instead of a new OpenAI call being made.
          </Form.Text>
        </Form.Group>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </Form>

      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="h6 mb-0">Usage</h2>
        <Button size="sm" variant="outline-secondary" onClick={refreshUsage}>
          Refresh
        </Button>
      </div>

      {today && (
        <div className="mb-3">
          <div className="d-flex justify-content-between small text-muted mb-1">
            <span>Today ({today.date})</span>
            <span>
              {today.count} / {dailyLimit}
            </span>
          </div>
          <ProgressBar
            now={Math.min((today.count / dailyLimit) * 100, 100)}
            variant={today.count >= dailyLimit ? "danger" : today.count / dailyLimit > 0.8 ? "warning" : "success"}
          />
        </div>
      )}

      <Table size="sm" bordered>
        <thead>
          <tr>
            <th>Date</th>
            <th className="text-end">Messages</th>
          </tr>
        </thead>
        <tbody>
          {usage.map((day) => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td className="text-end">{day.count}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
