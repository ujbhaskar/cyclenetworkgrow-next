"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { EVENT_STATUSES, type CyclingEvent, type EventStatus } from "@/lib/models/event";
import CreateEventModal from "./CreateEventModal";

export default function EventsTable({ initialEvents }: { initialEvents: CyclingEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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
        <Button onClick={() => setShowCreate(true)}>Add event</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Table responsive hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Dates</th>
            <th>Location</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.name}</td>
              <td>{event.category}</td>
              <td>
                {new Date(event.startDate).toLocaleDateString()} –{" "}
                {new Date(event.endDate).toLocaleDateString()}
              </td>
              <td>{event.location}</td>
              <td>
                <Form.Select
                  size="sm"
                  value={event.status}
                  onChange={(e) => handleStatusChange(event.id, e.target.value as EventStatus)}
                  style={{ width: 130 }}
                >
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
              </td>
              <td>
                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(event.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted text-center py-4">
                No events yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <CreateEventModal show={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />
    </div>
  );
}
