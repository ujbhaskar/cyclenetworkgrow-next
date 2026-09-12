"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import type { StravaConnection } from "@/lib/strava";

export default function StravaConnectionsTable({
  initialConnections,
}: {
  initialConnections: StravaConnection[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRevoke(athleteId: string, name: string) {
    if (!confirm(`Revoke ${name}'s Strava connection? They'll need to reconnect from their profile.`)) {
      return;
    }
    setError(null);
    setPendingId(athleteId);
    const res = await fetch(`/api/admin/strava/${athleteId}`, { method: "DELETE" });
    setPendingId(null);
    if (res.ok) {
      setConnections((list) => list.filter((c) => c.athleteId !== athleteId));
    } else {
      setError(`Couldn't revoke ${name}'s connection.`);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-1">Strava-Connected Riders</h1>
      <p className="text-muted mb-4">{connections.length} connected</p>

      {error && <Alert variant="danger">{error}</Alert>}

      {connections.length === 0 ? (
        <p className="text-muted">No riders have connected Strava yet.</p>
      ) : (
        <Table responsive hover>
          <thead>
            <tr>
              <th>Name</th>
              <th>City / State</th>
              <th>Phone</th>
              <th>Strava athlete id</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {connections.map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
              return (
                <tr key={c.athleteId}>
                  <td>{name}</td>
                  <td>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{c.athleteId}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => handleRevoke(c.athleteId, name)}
                      disabled={pendingId === c.athleteId}
                    >
                      {pendingId === c.athleteId ? "Revoking…" : "Revoke"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
