// Shared free-text normalization for anything that turns external data
// (Google Sheet rows, Razorpay payment notes, admin UI filters, ...) into
// consistent values — casing/format varies wildly across sources ("KOLKATA"
// / "kolkata" / "Kolkata", "Male"/"M"/"male") and should collapse to the
// same value regardless of source. Deliberately has NO import of
// src/lib/india-states.ts (which carries a `server-only` guard for its
// heavier state-abbreviation alias table) — every function here is plain,
// dependency-free string logic, safe to import from client components too
// (e.g. the admin Users table's city/state filter dropdowns). Full
// alias-aware state canonicalization (not just casing) lives in
// src/lib/india-states.ts's normalizeState, server-side only.

// Matches the legacy admin panel's exact AdminService.cleanPhone: strip
// everything but digits, keep the last 10 — the bare-digit, no-country-code
// format both `events/{id}.riders` and `athelete_tokens.athlete.phone`
// already use.
export function cleanPhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

// Exported for callers that just need consistent casing without a specific
// "is this a person's name/city" framing (e.g. a state filter dropdown that
// wants case-insensitive grouping but deliberately not full alias
// resolution — see src/components/admin/UsersTable.tsx).
export function titleCase(trimmed: string): string {
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Names arrive in every casing variant ("NISHANT PATEL" / "prasenjit Dey" /
// "vinod chetule") — title-cased so they display consistently regardless
// of source.
export function normalizeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed ? titleCase(trimmed) : "";
}

// Free-text city entries vary wildly in casing ("KOLKATA" / "kolkata" /
// "Kolkata") — title-case them so the same city always aggregates as one
// value instead of fragmenting into 2-3 near-duplicates in any city-based
// stat. Doesn't fix genuine spelling variants (e.g. "Bombay" vs "Mumbai"),
// only case.
export function normalizeCity(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed ? titleCase(trimmed) : "";
}

// Case/whitespace-only normalization for free text where a full canonical
// mapping isn't available (e.g. an admin filter dropdown's state options,
// which can't reach india-states.ts's server-only alias table from a
// client component) — identical logic to normalizeCity, just named for
// this "no domain-specific meaning" use case so call sites read clearly
// instead of e.g. calling normalizeCity on a state value.
export function normalizeCasing(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed ? titleCase(trimmed) : "";
}

// Free-text gender is inconsistent ("Male"/"MALE"/"male"/"M" all seen in
// real data) — same male/female recognition the legacy Angular admin's own
// getGender used (OnlineEventAddUserComponent), just case-insensitive.
// Anything else (blank, "Other", etc.) is title-cased rather than dropped.
export function normalizeGender(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (lower === "m" || lower === "male") {
    return "Male";
  }
  if (lower === "f" || lower === "female") {
    return "Female";
  }
  return titleCase(trimmed);
}
