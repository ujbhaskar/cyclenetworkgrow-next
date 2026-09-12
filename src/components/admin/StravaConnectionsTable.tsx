"use client";

import { useMemo, useState } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import Pagination from "react-bootstrap/Pagination";
import type { StravaConnection } from "@/lib/strava";

const PAGE_SIZE = 20;

// City/state are free text in the underlying data — same place written to by
// two different apps over the years — so "Delhi", "DELHI" and "delhi" all
// show up. Filters group by this normalized key; the dropdown displays one
// representative (Title Case) label per group instead of one entry per
// casing variant.
function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function buildFilterOptions(connections: StravaConnection[], field: "city" | "state") {
  const labelByKey = new Map<string, string>();
  for (const c of connections) {
    const raw = c[field];
    if (!raw) continue;
    const key = normalizeKey(raw);
    if (!labelByKey.has(key)) {
      labelByKey.set(key, toTitleCase(raw));
    }
  }
  return Array.from(labelByKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function StravaConnectionsTable({
  initialConnections,
}: {
  initialConnections: StravaConnection[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [page, setPage] = useState(1);

  const stateOptions = useMemo(() => buildFilterOptions(connections, "state"), [connections]);
  const cityOptions = useMemo(() => buildFilterOptions(connections, "city"), [connections]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return connections.filter((c) => {
      if (stateFilter && normalizeKey(c.state ?? "") !== stateFilter) {
        return false;
      }
      if (cityFilter && normalizeKey(c.city ?? "") !== cityFilter) {
        return false;
      }
      if (needle) {
        const haystack = [[c.firstName, c.lastName].filter(Boolean).join(" "), c.city, c.state, c.phone, c.athleteId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [connections, search, stateFilter, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateFilters(next: Partial<{ search: string; stateFilter: string; cityFilter: string }>) {
    if (next.search !== undefined) setSearch(next.search);
    if (next.stateFilter !== undefined) setStateFilter(next.stateFilter);
    if (next.cityFilter !== undefined) setCityFilter(next.cityFilter);
    setPage(1);
  }

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
      <p className="text-muted mb-4">
        {filtered.length} of {connections.length} connected
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-2 mb-3">
        <Col md={6}>
          <Form.Control
            placeholder="Search name, city, state, phone, athlete id…"
            value={search}
            onChange={(e) => updateFilters({ search: e.target.value })}
          />
        </Col>
        <Col md={3}>
          <Form.Select value={stateFilter} onChange={(e) => updateFilters({ stateFilter: e.target.value })}>
            <option value="">All states</option>
            {stateOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Select value={cityFilter} onChange={(e) => updateFilters({ cityFilter: e.target.value })}>
            <option value="">All cities</option>
            {cityOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      {filtered.length === 0 ? (
        <p className="text-muted">
          {connections.length === 0 ? "No riders have connected Strava yet." : "No riders match these filters."}
        </p>
      ) : (
        <>
          <Table responsive hover>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>City / State</th>
                <th>Phone</th>
                <th>Strava athlete id</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c, i) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={c.athleteId}>
                    <td>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      <a
                        href={`https://www.strava.com/athletes/${c.athleteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {name}
                      </a>
                    </td>
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

          {totalPages > 1 && (
            <Pagination>
              <Pagination.Prev disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Pagination.Item key={p} active={p === currentPage} onClick={() => setPage(p)}>
                  {p}
                </Pagination.Item>
              ))}
              <Pagination.Next
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </Pagination>
          )}
        </>
      )}
    </div>
  );
}
