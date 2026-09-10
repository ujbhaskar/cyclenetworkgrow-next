// Shared shape for the review/testimonial system — see
// docs/ARCHITECTURE.md §8.3. No server-only import, so both the admin
// moderation UI (client component) and server code can import it.

export const TESTIMONIAL_STATUSES = ["pending", "approved", "discarded"] as const;
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

export type Testimonial = {
  id: string;
  quote: string;
  title: string | null;
  // Resolved from the submitter's connected Strava profile at submit time
  // (if any) — see resolveStravaPhotoByPhone in src/lib/testimonials.ts.
  photoUrl: string | null;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  status: TestimonialStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
};
