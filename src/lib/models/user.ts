// The shared rider/admin schema — deliberately has no "server-only" import
// and no Firestore/Admin SDK dependency, so both client components (forms,
// header) and server code (Route Handlers, the DAL) can import it. Actual
// reads/writes live in src/lib/user-profile.ts (server-only); this file is
// just the shape both sides agree on.
//
// Matches docs/ARCHITECTURE.md §9's `users/{uid}` collection. No password
// field — Firebase Auth owns credentials, never Firestore.

// Single source of truth for valid roles — used to validate role-change
// requests server-side and to populate the role dropdown in the admin UI.
export const ROLES = ["rider", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type UserProfile = {
  uid: string;
  role: Role;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  address: string | null;
  stravaConnected: boolean;
  createdAt: string;
  // Reserved for future corporate/organization accounts (e.g. a "manager"
  // scoped to their own company's events and riders) — not used yet, always
  // null today. Added now so this doesn't need a data migration later; see
  // docs/REQUIREMENTS.md open questions for the actual design.
  organizationId: string | null;
};

// Fields a client is allowed to submit at signup — everything else on
// UserProfile (uid, role, createdAt, stravaConnected, and the derived
// email/phone/displayName) is computed or verified server-side only.
export type UserProfileSignupInput = {
  firstName?: string;
  lastName?: string;
  address?: string;
  phone?: string;
};
