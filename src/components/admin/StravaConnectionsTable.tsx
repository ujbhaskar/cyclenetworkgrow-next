"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import Dropdown from "react-bootstrap/Dropdown";
import type { StravaConnection } from "@/lib/strava";
import { normalizeCity } from "@/lib/registration-normalize";

const PAGE_SIZE = 30;

// Rider-supplied Strava display names/cities are free text and some are
// long (emoji, nicknames, hashtags) — cap each column so one long value
// can't blow out the whole table's width. table-layout: fixed (set on
// <Table> below) is what makes maxWidth actually bind instead of the
// column just growing to fit content; overflowWrap lets long unbroken
// strings wrap instead of overflowing.
const CELL_STYLE: CSSProperties = {
  // maxWidth: 300,
  overflowWrap: "break-word"
};

// The "#" column just holds a short number — capping it tight gives Name
// (the one most likely to need the room) more of the table's width.
const SERIAL_CELL_STYLE: CSSProperties = { ...CELL_STYLE, maxWidth: 50, width: 50 };

// City is still free text even after resolvedCity prefers a linked
// profile's structured value (see src/lib/strava.ts) — no canonical city
// list exists the way india-states.ts covers states. So city filtering
// still groups by this case-insensitive key, just applied to resolvedCity
// instead of the raw Strava text.
function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

// Sentinel for "has a state/city value, but it didn't resolve to anything
// clean" — a real, selectable bucket rather than silently omitting these
// riders from the filter entirely.
const OTHER_BUCKET = "__OTHER__";

function buildCityOptions(connections: StravaConnection[]) {
  const labelByKey = new Map<string, string>();
  for (const c of connections) {
    const raw = c.resolvedCity;
    if (!raw) continue;
    const key = normalizeKey(raw);
    if (!labelByKey.has(key)) {
      labelByKey.set(key, normalizeCity(raw));
    }
  }
  return Array.from(labelByKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// resolvedState is already a canonical Title Case value (from
// normalizeIndianState or a linked profile's own state field) — no need to
// re-normalize case, just collect the distinct values. Riders with a raw
// state that didn't resolve to anything get bucketed as "Other".
function buildStateOptions(connections: StravaConnection[]) {
  const values = new Set<string>();
  let hasOther = false;
  for (const c of connections) {
    if (c.resolvedState) {
      values.add(c.resolvedState);
    } else if (c.state) {
      hasOther = true;
    }
  }
  const options = Array.from(values)
    .map((label) => ({ key: label, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (hasOther) {
    options.push({ key: OTHER_BUCKET, label: "Other / unrecognized" });
  }
  return options;
}

type FilterOption = { key: string; label: string };

/**
 * Checkbox multi-select with its own search box at the top of the menu —
 * plain <select multiple> needs ctrl/cmd-click (not obvious), and City in
 * particular can have dozens of distinct values, so it needs to be
 * searchable rather than just a long scroll.
 */
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  const summary =
    selected.length === 0
      ? `All ${label.toLowerCase()}`
      : selected.length === 1
        ? (options.find((o) => o.key === selected[0])?.label ?? selected[0])
        : `${selected.length} ${label.toLowerCase()} selected`;

  return (
    <Dropdown autoClose="outside" onToggle={(isOpen) => !isOpen && setQuery("")}>
      <Dropdown.Toggle variant="outline-secondary" className="w-100 text-truncate text-start">
        {summary}
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ maxHeight: 340, overflowY: "auto", minWidth: 240 }}>
        <div className="px-2 pb-2">
          <Form.Control
            size="sm"
            autoFocus
            placeholder={`Search ${label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {selected.length > 0 && (
          <>
            <Dropdown.Item as="button" onClick={() => onChange([])}>
              Clear selection
            </Dropdown.Item>
            <Dropdown.Divider />
          </>
        )}
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-muted small">No matches</div>
        ) : (
          filteredOptions.map((o) => (
            <div key={o.key} className="px-3 py-1">
              <Form.Check
                type="checkbox"
                id={`filter-${label}-${o.key}`}
                label={o.label}
                checked={selected.includes(o.key)}
                onChange={() => toggle(o.key)}
              />
            </div>
          ))
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
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
  const [stateFilters, setStateFilters] = useState<string[]>([]);
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const stateOptions = useMemo(() => buildStateOptions(connections), [connections]);
  const cityOptions = useMemo(() => buildCityOptions(connections), [connections]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return connections.filter((c) => {
      if (stateFilters.length > 0) {
        const matchesOther = stateFilters.includes(OTHER_BUCKET) && !c.resolvedState && !!c.state;
        const matchesValue = !!c.resolvedState && stateFilters.includes(c.resolvedState);
        if (!matchesOther && !matchesValue) {
          return false;
        }
      }
      if (cityFilters.length > 0 && !cityFilters.includes(normalizeKey(c.resolvedCity ?? ""))) {
        return false;
      }
      if (needle) {
        const haystack = [
          [c.firstName, c.lastName].filter(Boolean).join(" "),
          c.city,
          c.state,
          c.resolvedCity,
          c.resolvedState,
          c.phone,
          c.athleteId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [connections, search, stateFilters, cityFilters]);

  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function handleSearchChange(value: string) {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleStateFiltersChange(next: string[]) {
    setStateFilters(next);
    setVisibleCount(PAGE_SIZE);
  }

  function handleCityFiltersChange(next: string[]) {
    setCityFilters(next);
    setVisibleCount(PAGE_SIZE);
  }

  // Callback ref (not useEffect) so the observer re-attaches correctly as
  // the sentinel element mounts/unmounts — it only renders while hasMore is
  // true, so it comes and goes as filters change and as more rows load.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount((c) => c + PAGE_SIZE);
          }
        },
        { rootMargin: "300px" }
      );
      observerRef.current.observe(node);
    }
  }, []);

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
        Showing {visibleItems.length} of {filtered.length} matching ({connections.length} connected total)
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-2 mb-3">
        <Col md={6}>
          <Form.Control
            placeholder="Search name, city, state, phone, athlete id…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <MultiSelectFilter
            label="States"
            options={stateOptions}
            selected={stateFilters}
            onChange={handleStateFiltersChange}
          />
        </Col>
        <Col md={3}>
          <MultiSelectFilter
            label="Cities"
            options={cityOptions}
            selected={cityFilters}
            onChange={handleCityFiltersChange}
          />
        </Col>
      </Row>

      {filtered.length === 0 ? (
        <p className="text-muted">
          {connections.length === 0 ? "No riders have connected Strava yet." : "No riders match these filters."}
        </p>
      ) : (
        <>
          <Table responsive hover style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={SERIAL_CELL_STYLE}>#</th>
                <th style={CELL_STYLE}>Name</th>
                <th style={CELL_STYLE}>City / State</th>
                <th style={CELL_STYLE}>Phone</th>
                <th style={CELL_STYLE}>Strava athlete id</th>
                <th style={CELL_STYLE} />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((c, i) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={c.athleteId}>
                    <td style={SERIAL_CELL_STYLE}>{i + 1}</td>
                    <td style={CELL_STYLE}>
                      <a
                        href={`https://www.strava.com/athletes/${c.athleteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {name}
                      </a>
                    </td>
                    <td style={CELL_STYLE}>
                      {[c.resolvedCity ?? c.city, c.resolvedState ?? c.state].filter(Boolean).join(", ") || "—"}
                      {c.linkedUid && (
                        <span className="badge bg-success bg-opacity-10 text-success ms-2" title="Matched to an app account by phone">
                          linked
                        </span>
                      )}
                    </td>
                    <td style={CELL_STYLE}>{c.phone ?? "—"}</td>
                    <td style={CELL_STYLE}>{c.athleteId}</td>
                    <td style={CELL_STYLE}>
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

          {hasMore && (
            // Intersection sentinel — scrolling this into view (300px early,
            // via rootMargin above) loads the next 30. Empty on purpose;
            // it's a trigger, not visible content.
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
        </>
      )}
    </div>
  );
}
