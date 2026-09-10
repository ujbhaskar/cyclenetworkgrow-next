// Firebase Auth's password provider is always tied to an email — there's no
// native "phone number + password" method. We derive a deterministic,
// unguessable-by-users synthetic email from the phone number so phone
// accounts can still use the same password provider under the hood. See
// docs/ARCHITECTURE.md §4 (auth) for the reasoning.

const SYNTHETIC_EMAIL_DOMAIN = "phone.letscng.internal";

export function normalizePhone(rawPhone: string): string {
  const trimmed = rawPhone.trim().replace(/[\s-()]/g, "");
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  // Assume India (+91) when no country code is given, matching the current
  // Angular app's behavior (letscng-ui strips +91/+1 for its own lookups).
  return `+91${trimmed.replace(/^0+/, "")}`;
}

export function phoneToSyntheticEmail(rawPhone: string): string {
  const normalized = normalizePhone(rawPhone);
  const digitsOnly = normalized.replace(/\D/g, "");
  return `${digitsOnly}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@") && !identifier.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

export function isSyntheticEmail(email: string): boolean {
  return email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

// Reverses phoneToSyntheticEmail — safe because the domain encodes nothing
// but the digits, so it round-trips exactly.
export function syntheticEmailToPhone(syntheticEmail: string): string {
  const digitsOnly = syntheticEmail.split("@")[0];
  return `+${digitsOnly}`;
}

// India, North America, Europe, Australia — the community is India-focused,
// so +91 stays first/default.
export const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "US/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+61", label: "Australia (+61)" },
] as const;

export const DEFAULT_COUNTRY_CODE = "+91";
