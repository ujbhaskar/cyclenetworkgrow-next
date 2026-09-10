import "server-only";

// Riders' `state` field comes from Strava's free-text athlete profile, not
// a validated dropdown — real data has abbreviations ("UP", "TN", "A.P."),
// inconsistent casing/whitespace, decorative unicode text, and non-state
// values like "INDIA". This maps the variants actually seen in production
// to a canonical state/UT name; anything unrecognized returns null and is
// excluded from state-level stats rather than risk misattributing it.
const STATE_ALIASES: Record<string, string> = {
  "ANDAMAN AND NICOBAR ISLANDS": "Andaman and Nicobar Islands",
  "ANDHRA PRADESH": "Andhra Pradesh",
  "AP": "Andhra Pradesh",
  "A P": "Andhra Pradesh",
  "A.P.": "Andhra Pradesh",
  "ARUNACHAL PRADESH": "Arunachal Pradesh",
  "ASSAM": "Assam",
  "BIHAR": "Bihar",
  "CHANDIGARH": "Chandigarh",
  "CHHATTISGARH": "Chhattisgarh",
  "CG": "Chhattisgarh",
  "DELHI": "Delhi",
  "NEW DELHI": "Delhi",
  "NCR": "Delhi",
  "GOA": "Goa",
  "GUJARAT": "Gujarat",
  "HARYANA": "Haryana",
  "HIMACHAL PRADESH": "Himachal Pradesh",
  "HP": "Himachal Pradesh",
  "JAMMU AND KASHMIR": "Jammu and Kashmir",
  "J&K": "Jammu and Kashmir",
  "JK": "Jammu and Kashmir",
  "JHARKHAND": "Jharkhand",
  "KARNATAKA": "Karnataka",
  "KERALA": "Kerala",
  "LADAKH": "Ladakh",
  "MADHYA PRADESH": "Madhya Pradesh",
  "MP": "Madhya Pradesh",
  "MAHARASHTRA": "Maharashtra",
  "MANIPUR": "Manipur",
  "MEGHALAYA": "Meghalaya",
  "MIZORAM": "Mizoram",
  "NAGALAND": "Nagaland",
  "ODISHA": "Odisha",
  "ORISSA": "Odisha",
  "PUDUCHERRY": "Puducherry",
  "PONDICHERRY": "Puducherry",
  "PUNJAB": "Punjab",
  "RAJASTHAN": "Rajasthan",
  "SIKKIM": "Sikkim",
  "TAMIL NADU": "Tamil Nadu",
  "TAMILNADU": "Tamil Nadu",
  "TN": "Tamil Nadu",
  "TELANGANA": "Telangana",
  "TS": "Telangana",
  "TRIPURA": "Tripura",
  "UTTAR PRADESH": "Uttar Pradesh",
  "UTTRAKHAND": "Uttarakhand",
  "UP": "Uttar Pradesh",
  "UTTARAKHAND": "Uttarakhand",
  "UK": "Uttarakhand",
  "WEST BENGAL": "West Bengal",
  "WB": "West Bengal",
};

export function normalizeIndianState(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const key = raw.trim().toUpperCase().replace(/\s+/g, " ");
  return STATE_ALIASES[key] ?? null;
}
