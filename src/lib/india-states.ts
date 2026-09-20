import "server-only";

// Riders' `state` field comes from Strava's free-text athlete profile, not
// a validated dropdown — real data has abbreviations ("UP", "TN", "A.P."),
// misspellings, decorative unicode (flags, hearts), phone numbers/URLs
// tacked onto the end (people paste their whole bio), a trailing "India"/
// "भारत" (Hindi for "India"), and non-state values like "INDIA" on its own.
// This maps the variants actually seen in production to a canonical
// state/UT name; anything unrecognized returns null and is excluded from
// state-level stats/filters rather than risk misattributing it. See
// docs/ARCHITECTURE.md's data-model notes and the admin Strava riders list
// (src/components/admin/StravaConnectionsTable.tsx) for where this matters.
const STATE_ALIASES: Record<string, string> = {
  "ANDAMAN AND NICOBAR ISLANDS": "Andaman and Nicobar Islands",
  "ANDHRA PRADESH": "Andhra Pradesh",
  AP: "Andhra Pradesh",
  "A P": "Andhra Pradesh",
  "ARUNACHAL PRADESH": "Arunachal Pradesh",
  ASSAM: "Assam",
  BIHAR: "Bihar",
  CHANDIGARH: "Chandigarh",
  CHHATTISGARH: "Chhattisgarh",
  CG: "Chhattisgarh",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "Dadra and Nagar Haveli and Daman and Diu",
  DELHI: "Delhi",
  "NEW DELHI": "Delhi",
  NCR: "Delhi",
  GOA: "Goa",
  GUJARAT: "Gujarat",
  HARYANA: "Haryana",
  "HIMACHAL PRADESH": "Himachal Pradesh",
  HP: "Himachal Pradesh",
  "JAMMU AND KASHMIR": "Jammu and Kashmir",
  "J&K": "Jammu and Kashmir",
  JK: "Jammu and Kashmir",
  JHARKHAND: "Jharkhand",
  KARNATAKA: "Karnataka",
  KERALA: "Kerala",
  LADAKH: "Ladakh",
  LAKSHADWEEP: "Lakshadweep",
  "MADHYA PRADESH": "Madhya Pradesh",
  MP: "Madhya Pradesh",
  MAHARASHTRA: "Maharashtra",
  "महाराष्ट्र": "Maharashtra",
  MANIPUR: "Manipur",
  MEGHALAYA: "Meghalaya",
  MIZORAM: "Mizoram",
  NAGALAND: "Nagaland",
  ODISHA: "Odisha",
  ORISSA: "Odisha",
  PUDUCHERRY: "Puducherry",
  "UT OF PUDUCHERRY": "Puducherry",
  PONDICHERRY: "Puducherry",
  PUNJAB: "Punjab",
  RAJASTHAN: "Rajasthan",
  SIKKIM: "Sikkim",
  "TAMIL NADU": "Tamil Nadu",
  TAMILNADU: "Tamil Nadu",
  TN: "Tamil Nadu",
  TELANGANA: "Telangana",
  TS: "Telangana",
  TRIPURA: "Tripura",
  "UTTAR PRADESH": "Uttar Pradesh",
  UTTARPRADESH: "Uttar Pradesh",
  UP: "Uttar Pradesh",
  UTTARAKHAND: "Uttarakhand",
  UTTRAKHAND: "Uttarakhand",
  UTTARANCHAL: "Uttarakhand", // official name pre-2007
  "U K": "Uttarakhand",
  "उत्तराखंड": "Uttarakhand",
  "WEST BENGAL": "West Bengal",
  WESTBENGAL: "West Bengal",
  "WEST BANGAL": "West Bengal", // common typo
  WB: "West Bengal",
};

// Strips the free-text junk seen in real profiles before attempting the
// alias lookup — URLs, "Mobile: <number>"-style suffixes, bare long digit
// runs (phone numbers), decorative emoji/flags, and a trailing "India"/
// "भारत". Order matters: this runs on the original-case string so the
// case-insensitive regexes below work, then the result is uppercased for
// the alias-table lookup.
function cleanForLookup(raw: string): string {
  const withoutJunk = raw
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(mobile|phone|call|contact)\b.*/i, " ")
    .replace(/\d{5,}/g, " ")
    // Emoji/flags/pictographs/dingbats — deliberately doesn't touch
    // Devanagari (U+0900–U+097F) or Latin text.
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, " ")
    .replace(/भारत/g, " ");

  return withoutJunk
    .toUpperCase()
    .replace(/\bINDIA\b/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIndianState(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  return STATE_ALIASES[cleanForLookup(raw)] ?? null;
}

// Same "collapse free-text variants to one consistent value" idea as
// src/lib/registration-normalize.ts's normalizeCity/normalizeName, but for
// state — resolves real abbreviations/misspellings via the alias table
// above, not just casing. Falls back to a trimmed/case-collapsed version of
// the raw value for anything the alias table doesn't recognize (a
// non-Indian entry, say), rather than silently dropping real data. Needs
// this file's `server-only` guard (the alias table), so only usable from
// server-side code — see registration-normalize.ts for the client-safe,
// casing-only equivalent used by e.g. the admin Users filter.
export function normalizeState(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return normalizeIndianState(trimmed) ?? trimmed;
}
