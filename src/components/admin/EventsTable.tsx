"use client";

import { useState } from "react";
import Link from "next/link";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import Alert from "react-bootstrap/Alert";
import { EVENT_STATUSES, type EventStatus } from "@/lib/models/event";
import type { EventAdminSummary } from "@/lib/events";
import EventFormModal from "./EventFormModal";

export default function EventsTable({ initialEvents }: { initialEvents: EventAdminSummary[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [formEventId, setFormEventId] = useState<string | null | "new">(null);
  const [formInitialEvent, setFormInitialEvent] = useState<Record<string, unknown> | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);

  function openCreateForm() {
    setFormInitialEvent(null);
    setFormEventId("new");
  }

  async function openEditForm(id: string) {
    setError(null);
    setEditLoadingId(id);
    const res = await fetch(`/api/admin/events/${id}`);
    setEditLoadingId(null);
    if (!res.ok) {
      setError("Couldn't load that event.");
      return;
    }
    const body = await res.json();
    setFormInitialEvent(body.event ?? null);
    setFormEventId(id);
  }

  async function refetch() {
    const res = await fetch("/api/admin/events");
    if (res.ok) {
      const body = await res.json();
      setEvents(body.events);
    }
  }

  async function handleStatusChange(id: string, status: EventStatus) {
    setError(null);
    const previous = events;
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, status } : e)));
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setEvents(previous);
      setError("Couldn't update that event's status.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event permanently?")) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEvents((list) => list.filter((e) => e.id !== id));
    } else {
      setError("Couldn't delete that event.");
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Events</h1>
        <Button onClick={openCreateForm}>Add event</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Table responsive hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Dates</th>
            <th>Type</th>
            <th className="text-center">Riders</th>
            <th className="text-center">Published</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.name}</td>
              <td>{event.categoryLabel}</td>
              <td>
                {event.startDate ? new Date(event.startDate).toLocaleDateString() : "—"} –{" "}
                {event.endDate ? new Date(event.endDate).toLocaleDateString() : "—"}
              </td>
              <td>{event.eventType ?? "—"}</td>
              <td className="text-center">{event.riderCount}</td>
              <td className="text-center">
                {event.publish ? (
                  <Badge bg="success" className="bg-opacity-10 text-success">
                    Yes
                  </Badge>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td>
                <Form.Select
                  size="sm"
                  value={event.status ?? ""}
                  onChange={(e) => handleStatusChange(event.id, e.target.value as EventStatus)}
                  style={{ width: 140 }}
                >
                  <option value="">—</option>
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
              </td>
              <td className="text-nowrap">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="me-2"
                  onClick={() => openEditForm(event.id)}
                  disabled={editLoadingId === event.id}
                >
                  {editLoadingId === event.id ? "Loading…" : "Edit"}
                </Button>
                {event.hasRegistrationSheet && (
                  <Link href={`/admin/events/${event.id}/registrations`} className="btn btn-sm btn-outline-primary me-2">
                    Registrations
                  </Link>
                )}
                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(event.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={8} className="text-muted text-center py-4">
                No events yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <EventFormModal
        key={formEventId ?? "closed"}
        show={formEventId !== null}
        eventId={formEventId === "new" ? null : formEventId}
        initialEvent={formEventId === "new" ? null : formInitialEvent}
        onClose={() => setFormEventId(null)}
        onSaved={refetch}
      />
    </div>
  );
}
